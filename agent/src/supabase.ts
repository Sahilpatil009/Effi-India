import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  COMPLAINT_EVIDENCE_BUCKET,
  type ComplaintInsertInput,
} from "./types.js";

let supabaseAdminClient: SupabaseClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  supabaseAdminClient = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  return supabaseAdminClient;
}

export function generateTicketNumber(userId: string, registrationKey: string): string {
  if (!userId || !registrationKey) throw new Error("Missing registration identity.");
  // The existing unique ticket_number constraint arbitrates concurrent workers.
  // One call represents one complaint, even if a tool retries after a lost response.
  const hash = createHash("sha256")
    .update(JSON.stringify([userId, registrationKey]))
    .digest("hex").slice(0, 24).toUpperCase();
  return `EFF-${hash}`;
}

export function parseStoragePath(photoUrl: string | null, category: string, roomName: string, supabaseUrl: string): string | null {
  if (!photoUrl) {
    return null;
  }

  const url = new URL(photoUrl);
  const marker = `/storage/v1/object/public/${COMPLAINT_EVIDENCE_BUCKET}/`;
  const sanitize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const path = decodeURIComponent(url.pathname.slice(marker.length));
  const prefix = `${sanitize(category)}/${sanitize(roomName)}/`;
  if (url.origin !== new URL(supabaseUrl).origin || url.username || url.password || url.search || url.hash ||
      !url.pathname.startsWith(marker) || !path.startsWith(prefix) ||
      !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(path.slice(prefix.length))) {
    throw new Error("Photo must belong to this complaint session in the configured evidence bucket.");
  }
  return path;
}

export async function insertComplaint(
  input: ComplaintInsertInput,
  supabase = getSupabaseAdminClient(),
) {
  const ticketNumber = generateTicketNumber(input.userId, input.registrationKey);
  const storagePath = input.photoUrl ? parseStoragePath(input.photoUrl, input.category, input.registrationKey, getRequiredEnv("SUPABASE_URL")) : null;

  const { data, error } = await supabase.rpc("create_complaint_ticket", {
    complaint_payload: {
      user_id: input.userId,
      ticket_number: ticketNumber,
      category: input.category,
      problem_type: input.problemType,
      description: input.description,
      summary: input.summary,
      caller_name: input.callerName,
      language: input.language,
      status: "open",
      location: input.location,
      photo_url: input.photoUrl,
      storage_bucket: input.photoUrl ? COMPLAINT_EVIDENCE_BUCKET : null,
      storage_path: storagePath,
      transcript_turns: input.transcript.map((turn) => ({
        turn_index: turn.turnIndex,
        speaker: turn.speaker,
        content: turn.content,
        raw_payload: turn.rawPayload,
      })),
    },
  });

  if (error) {
    // A committed RPC may have lost its response, or another worker may have
    // won the unique insert. Recover only this user's exact persisted ticket.
    const { data: existing, error: lookupError } = await supabase
      .from("complaints")
      .select("id,ticket_number")
      .eq("ticket_number", ticketNumber)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!lookupError && existing?.id && existing?.ticket_number === ticketNumber) {
      return { complaintId: existing.id as string, ticketNumber };
    }
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  const inserted = Array.isArray(data) ? data[0] : data;
  if (!inserted?.complaint_id || !inserted?.ticket_number) {
    throw new Error("Supabase insert failed: complaint RPC returned no result.");
  }

  return {
    complaintId: inserted.complaint_id as string,
    ticketNumber: inserted.ticket_number as string,
  };
}

import type { Timestamp } from "@/proto/google/protobuf/timestamp";

export function timestampToDate(value?: Timestamp): Date {
  return value ? new Date(Number(value.seconds) * 1000 + value.nanos / 1e6) : new Date(0);
}

export function optionalTimestampToDate(value?: Timestamp): Date | undefined {
  return value ? timestampToDate(value) : undefined;
}

"use client";

import { SegmentError, type SegmentErrorProps } from "@/components/feedback/SegmentError";

export default function NucleoError(props: SegmentErrorProps) {
  return <SegmentError {...props} segment="nucleo" />;
}

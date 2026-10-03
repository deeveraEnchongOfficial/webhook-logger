import { notFound } from "next/navigation";
import Inspector from "@/components/Inspector";
import { isValidBinId } from "@/lib/validate";

export default async function BinPage({
  params,
}: {
  params: Promise<{ binId: string }>;
}) {
  const { binId } = await params;
  if (!isValidBinId(binId)) notFound();
  return <Inspector binId={binId} />;
}

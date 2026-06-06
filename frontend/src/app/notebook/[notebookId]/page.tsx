import { notFound } from "next/navigation";
import { NotebookRuntimePage } from "@/components/notebook-runtime-page";
import { NOTEBOOK_CATALOG } from "@/data/notebook-catalog";

interface NotebookRouteParams {
  params: Promise<{ notebookId: string }>;
}

export function generateStaticParams() {
  return NOTEBOOK_CATALOG.map((entry) => ({ notebookId: entry.id }));
}

export default async function NotebookPage({ params }: NotebookRouteParams) {
  const { notebookId } = await params;
  const notebookMeta = NOTEBOOK_CATALOG.find((entry) => entry.id === notebookId);

  if (!notebookMeta) {
    notFound();
  }

  return <NotebookRuntimePage notebookMeta={notebookMeta} />;
}

// src/app/documenti/page.tsx
import DocumentsPublicBox from "@/components/AtlasModuli/Documenti/DocumentiBox";

export default function DocumentiPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold mb-4">Documenti</h1>
      <DocumentsPublicBox />
    </div>
  );
}

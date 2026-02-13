import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import ProcessWhiteboardBox from "@/components/AtlasModuli/ProcessBoard/ProcessWhiteboardBox";

export const metadata: Metadata = {
  title: "Whiteboard Processi",
};

export default function ProcessWhiteboardPage() {
  return (
    <>
      <Breadcrumb pageName="Whiteboard Processi" />
      <ProcessWhiteboardBox />
    </>
  );
}

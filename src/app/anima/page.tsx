import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import AnimaLab from "@/components/Anima/AnimaLab";

export const metadata: Metadata = {
  title: "Anima Lab",
  description: "Interfaccia minima di test per il core di Anima",
};

export default function AnimaPage() {
  return (
    <>
      <Breadcrumb pageName="Anima Lab" />
      <AnimaLab />
    </>
  );
}

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import CalendarBox from "../../components/AtlasModuli/Calendario/CalendarBox";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendario",
  // other metadata
};

const CalendarPage = () => {
  return (
    <>
      <Breadcrumb pageName="Calendario Corsi ed Eventi" />
      <CalendarBox />
    </>
  );
};

export default CalendarPage;

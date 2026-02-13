import UserMailPanel from "@/components/Inbox/Mail/UserMailPanel";

export const dynamic = "force-dynamic";

export default function MailPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6">
      <UserMailPanel />
    </div>
  );
}

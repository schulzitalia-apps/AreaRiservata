"use client";

import { ChevronUpIcon, EmailIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/server-utils/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogOutIcon, SettingsIcon, UserIcon } from "./icons";
import { useAppSelector } from "@/components/Store/hooks";
import { signOut } from "next-auth/react";

const PLACEHOLDER = "/images/user/user-02.png";

export function UserInfo() {
  const [isOpen, setIsOpen] = useState(false);

  // Redux
  const sessionUser = useAppSelector((s) => s.session.user);
  const profile = useAppSelector((s) => s.profile?.data);
  const isAuthed = useAppSelector((s) => s.session.status === "authenticated");

  // Nome / email
  const displayName = useMemo(() => {
    return (
      profile?.fullName ||
      sessionUser?.name ||
      sessionUser?.email ||
      "Account"
    );
  }, [profile?.fullName, sessionUser?.name, sessionUser?.email]);

  const displayEmail = sessionUser?.email || "";

  // URL avatar: usiamo avatarKey o placeholder
  const avatarUrl = useMemo(() => {
    if (profile?.avatarKey) {
      return profile.avatarKey;
    }
    return PLACEHOLDER;
  }, [profile?.avatarKey]);

  const [imgSrc, setImgSrc] = useState<string>(avatarUrl);

  useEffect(() => {
    setImgSrc(avatarUrl);
  }, [avatarUrl]);

  if (!isAuthed) return null;

  async function handleLogout() {
    await signOut({ callbackUrl: "/auth/sign-in", redirect: true });
  }

  function AvatarImg(props: { alt: string; className?: string }) {
    return (
      <Image
        src={imgSrc}
        alt={props.alt}
        width={200}
        height={200}
        className={cn("size-12 rounded-full object-cover", props.className)}
        onError={() => setImgSrc(PLACEHOLDER)}
        priority={false}
      />
    );
  }

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>

        <figure className="flex items-center gap-3">
          <AvatarImg alt={`Avatar of ${displayName}`} />
          <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6 max-[1024px]:sr-only">
            <span>{displayName}</span>
            <ChevronUpIcon
              aria-hidden
              className={cn(
                "rotate-180 transition-transform",
                isOpen && "rotate-0"
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-black min-[230px]:min-w-[17.5rem]"
        align="end"
      >
        <h2 className="sr-only">User information</h2>

        <figure className="flex items-center gap-2.5 px-5 py-3.5">
          <AvatarImg alt={`Avatar for ${displayName}`} />
          <figcaption className="space-y-1 text-base font-medium">
            <div className="mb-2 leading-none text-dark dark:text-white">
              {displayName}
            </div>
            <div className="leading-none text-gray-6">{displayEmail}</div>
          </figcaption>
        </figure>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6 [&>*]:cursor-pointer">
          <Link
            href={"/profile"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <UserIcon />
            <span className="mr-auto text-base font-medium">Vai al Profilo</span>
          </Link>

          <Link
            href={"/pages/settings"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <SettingsIcon />
            <span className="mr-auto text-base font-medium">
              Impostazioni Account
            </span>
          </Link>

          {/* ⭐ Nuova voce Tickets */}
          <Link
            href={"/tickets"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <EmailIcon />
            <span className="mr-auto text-base font-medium">Tickets</span>
          </Link>
        </div>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
            onClick={handleLogout}
          >
            <LogOutIcon />
            <span className="text-base font-medium">Esci</span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

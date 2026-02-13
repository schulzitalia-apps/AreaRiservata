// app/settings/_components/personal-info.tsx
"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchMyProfile, updateMyProfile } from "@/components/Store/slices/profileSlice";

import {
  CallIcon,
  EmailIcon,
  PencilSquareIcon,
  UserIcon,
} from "@/assets/icons";

import InputGroup from "@/components/FormElements/InputGroup";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import { cn } from "@/server-utils/lib/utils";

export function PersonalInfoForm() {
  const dispatch = useAppDispatch();

  // dallo store: profilo (profileSlice) e sessione (NextAuth → session slice)
  const { data: profile, status } = useAppSelector((s) => s.profile);
  const sessionUser = useAppSelector((s) => s.session.user);

  // stato locale del form (controllato)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  // carico profilo al primo giro
  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchMyProfile());
    }
  }, [status, dispatch]);

  // quando arriva il profilo nello store → prefill campi
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName ?? "");
      setPhone(profile.phone ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  // submit → PATCH via thunk → extraReducers aggiornano lo store
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await dispatch(updateMyProfile({ fullName, phone, bio }));
    // opzionale: riflettere anche nella sessione NextAuth per header/menu:
    // const { update } = useSession(); await update({ name: fullName });
  }

  // reset → riprendo i valori dallo store
  function onReset() {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setPhone(profile.phone ?? "");
    setBio(profile.bio ?? "");
  }

  const email = sessionUser?.email ?? "";

  return (
    <ShowcaseSection title="Informazioni Personali" className="!p-7">
      <form onSubmit={onSubmit}>
        <div className="mb-5.5 flex flex-col gap-5.5 sm:flex-row">
          <InputGroup
            className="w-full sm:w-1/2"
            type="text"
            name="fullName"
            label="Nome Completo"
            placeholder="Il tuo nome"
            value={fullName}
            handleChange={(e) => setFullName(e.target.value)}
            icon={<UserIcon />}
            iconPosition="left"
            height="sm"
          />

          <InputGroup
            className="w-full sm:w-1/2"
            type="text"
            name="phoneNumber"
            label="Numero di Telefono"
            placeholder="+39 ..."
            value={phone}
            handleChange={(e) => setPhone(e.target.value)}
            icon={<CallIcon />}
            iconPosition="left"
            height="sm"
          />
        </div>

        {/* Email: source of truth = sessione auth → mostro disabilitata */}
        <InputGroup
          className="mb-5.5"
          type="email"
          name="email"
          label="Indirizzo Email"
          placeholder="email"
          value={email}
          icon={<EmailIcon />}
          iconPosition="left"
          height="sm"
          disabled
        />


        <div className="mb-5.5">
          <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
            BIO
          </label>

          <div className="relative mt-3 [&_svg]:pointer-events-none [&_svg]:absolute [&_svg]:left-5.5 [&_svg]:top-5.5">
            <textarea
              rows={6}
              placeholder="La tua bio qui..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={cn(
                "w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary disabled:cursor-default disabled:bg-gray-2 mock-[active=true]:border-primary dark:border-dark-3 dark:bg-dark-1 dark:text-white dark:focus:border-primary dark:disabled:bg-dark dark:mock-[active=true]:border-primary",
                "py-5 pl-13 pr-5"
              )}
            />
            <span className="pointer-events-none absolute left-5.5 top-5.5">
              <PencilSquareIcon />
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            className="rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3 dark:text-white"
            type="button"
            onClick={onReset}
          >
            Annulla
          </button>

          <button
            className="flex justify-center rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3 dark:text-white"
            type="submit"
            disabled={status === "loading"}
          >
            Salva
          </button>
        </div>
      </form>
    </ShowcaseSection>
  );
}

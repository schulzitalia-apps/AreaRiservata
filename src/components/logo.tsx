import darkLogo from "@/assets/logos/logo_bianco.png";
import logo from "../../public/images/logo/logo_nero.png";
import Image from "next/image";
import clsx from "clsx";

type LogoProps = {
  className?: string;
  alt?: string;
  priority?: boolean;
  sizes?: string;
};

export function Logo({
                       className,
                       alt = "Your logo",
                       priority,
                       sizes = "(max-width: 640px) 140px, (max-width: 1024px) 180px, 220px",
                     }: LogoProps) {
  return (
    <div className={clsx("inline-block max-w-full", className)}>
      {/* Light */}
      <Image
        src={logo}
        alt={alt}
        placeholder="blur"
        priority={priority}
        sizes={sizes}
        style={{ width: "100%", height: "auto" }}
        className="dark:hidden"
      />
      {/* Dark */}
      <Image
        src={darkLogo}
        alt={alt}
        placeholder="blur"
        priority={priority}
        sizes={sizes}
        style={{ width: "100%", height: "auto" }}
        className="hidden dark:block"
      />
    </div>
  );
}

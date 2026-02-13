import Link from "next/link";
import SigninWithPassword from "../SigninWithPassword";

export default function Signin() {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <>

      <div className="my-6 flex items-center justify-center">
        <span className="block h-px w-full bg-stroke dark:bg-dark-3"></span>
        <div className="block w-full min-w-fit bg-white px-3 text-center font-medium dark:bg-gray-dark">
          Accedi con la tua mail
        </div>
        <span className="block h-px w-full bg-stroke dark:bg-dark-3"></span>
      </div>

      <div>
        <SigninWithPassword />
      </div>

    </>
  );
}

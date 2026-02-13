import * as React from "react";

export function CardHeader({
                             title,
                             subTitle,
                             right,
                           }: {
  title: string;
  subTitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div>
        <h2 className="text-base font-extrabold text-dark dark:text-white">{title}</h2>
        {subTitle ? (
          <div className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-dark-6">
            {subTitle}
          </div>
        ) : null}
      </div>
      {right ? <div className="pt-0.5">{right}</div> : null}
    </div>
  );
}

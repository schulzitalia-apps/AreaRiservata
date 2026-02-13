"use client";

import { useEffect, useMemo, useState } from "react";
import { getTopSellers, ITALIAN_REGIONS, Seller } from "../fetch-sellers";
import { cn } from "@/server-utils/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  className?: string;
  initialRegion?: string;
};

const euro = (n: number) =>
  n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

export function TopSellers({ className, initialRegion = "ITALIA" }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<Seller[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getTopSellers(selectedRegion).then((rows) => {
      if (!active) return;
      setData(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [selectedRegion]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const code = (ce.detail?.code as string) || "ITALIA";
      setSelectedRegion(code);
    };
    window.addEventListener("region:selected", handler as EventListener);
    return () =>
      window.removeEventListener("region:selected", handler as EventListener);
  }, []);

  const options = useMemo(() => ITALIAN_REGIONS, []);

  const top5 = useMemo(() => data.slice(0, 5), [data]);

  return (
    <div
      className={cn(
        "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          Top Sellers
          <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            ({selectedRegion})
          </span>
        </h2>

        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="w-[210px] rounded-md border bg-transparent px-3 py-2 text-sm outline-none dark:border-gray-700"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-none uppercase [&>th]:text-center">
              <TableHead className="min-w-[140px] !text-left">Cliente</TableHead>
              <TableHead>N° Ordini</TableHead>
              <TableHead className="!text-right">Revenues</TableHead>
              <TableHead>Valore Medio Ordine</TableHead>
              <TableHead>Affidabilità</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {top5.map((seller, i) => (
              <TableRow
                key={seller.name + i}
                className="text-center text-base font-medium text-dark dark:text-white"
              >
                <TableCell className="min-w-fit !text-left">
                  {seller.name}
                </TableCell>

                <TableCell>{seller.orders.toLocaleString("it-IT")}</TableCell>

                <TableCell className="!text-right text-green-light-1">
                  {euro(seller.revenues)}
                </TableCell>

                <TableCell>{euro(seller.avgOrderValue)}</TableCell>

                <TableCell>{seller.reliability}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="border-none uppercase [&>th]:text-center">
            <TableHead className="!text-left">Cliente</TableHead>
            <TableHead>N° Ordini</TableHead>
            <TableHead className="!text-right">Revenues</TableHead>
            <TableHead>Valore Medio Ordine</TableHead>
            <TableHead>Affidabilità</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={100}>
                <Skeleton className="h-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

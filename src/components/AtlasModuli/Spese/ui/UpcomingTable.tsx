import { cn } from "@/server-utils/lib/utils";
import type { UpcomingExpense } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { euro } from "../format";

export function UpcomingTable({ rows }: { rows: UpcomingExpense[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-none uppercase">
          <TableHead className="!text-left text-gray-600 dark:text-dark-6">Voce</TableHead>
          <TableHead className="!text-right text-gray-600 dark:text-dark-6">Importo</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((r, i) => (
          <TableRow
            key={r.title + i}
            className={cn("text-sm font-semibold text-dark dark:text-white", "hover:bg-gray-50 dark:hover:bg-dark-2")}
          >
            <TableCell className="!text-left">
              <div className="font-extrabold">{r.title}</div>
              <div className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-dark-6">{r.dateLabel}</div>
            </TableCell>

            <TableCell className="!text-right font-black">{euro(r.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

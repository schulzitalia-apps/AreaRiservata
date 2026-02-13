"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { endGlobalLoading, selectGlobalLoading } from "@/components/Store/slices/uiSlice";

export default function NavigationLoadingBridge() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectGlobalLoading);

  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (loading) dispatch(endGlobalLoading());
    }
  }, [pathname, loading, dispatch]);

  return null;
}

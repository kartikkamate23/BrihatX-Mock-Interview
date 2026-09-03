import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { History, LayoutDashboard, Sparkles } from "lucide-react";

import { getCurrentUser } from "@/lib/actions/auth.action";
import SignOutButton from "@/components/SignOutButton";

const Layout = async ({ children }: { children: ReactNode }) => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const initials = user.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

  return (
    <div className="root-layout">
      <nav className="dashboard-nav" aria-label="Primary navigation">
        <Link href="/" className="brand-link" aria-label="BrihatX AI Interview dashboard">
          <span className="brand-mark"><Image src="/logo.svg" alt="" aria-hidden width={35} height={31} priority /></span>
          <span className="hidden min-w-0 min-[460px]:block">
            <span className="block truncate text-sm font-bold tracking-[-0.02em] text-white sm:text-base">BrihatX</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-light-100/55 sm:block">AI Interview</span>
          </span>
        </Link>

        <div className="nav-actions">
          <Link href="/" className="nav-link" aria-label="Dashboard">
            <LayoutDashboard aria-hidden /><span className="hidden lg:inline">Dashboard</span>
          </Link>
          <Link href="/interview" className="nav-link nav-link-accent" aria-label="Start an interview">
            <Sparkles aria-hidden /><span className="hidden min-[700px]:inline">Practice</span>
          </Link>
          <Link href="/#interviews" className="nav-link hidden sm:inline-flex" aria-label="Interview history">
            <History aria-hidden /><span className="hidden lg:inline">History</span>
          </Link>
          <Link href="/pricing" className="nav-link"><span className="hidden min-[540px]:inline">Plans</span><span className="min-[540px]:hidden" aria-hidden="true">₹</span></Link>
          <span className="nav-user" aria-label={`Signed in as ${user.name}`}>{initials}</span>
          <span className="nav-signout"><SignOutButton /></span>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1} className="outline-none">{children}</main>
    </div>
  );
};

export default Layout;

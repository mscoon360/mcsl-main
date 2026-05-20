import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  FileText,
  ScrollText,
  TrendingUp,
  Scale,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
} from 'lucide-react';

const reportNav = [
  { name: 'General Ledger',     to: 'general-ledger',  icon: BookOpen },
  { name: 'Account Ledger',     to: 'account-ledger',  icon: FileText },
  { name: 'Journal Day Book',   to: 'journal-day-book',icon: ScrollText },
  { name: 'Profit & Loss',      to: 'profit-and-loss', icon: TrendingUp },
  { name: 'Balance Sheet',      to: 'balance-sheet',   icon: Scale },
  { name: 'AR Aging',           to: 'ar-aging',        icon: ArrowDownToLine },
  { name: 'AP Aging',           to: 'ap-aging',        icon: ArrowUpFromLine },
  { name: 'VAT Report',         to: 'vat-report',      icon: Receipt },
];

export default function Reports() {
  const location = useLocation();

  // Redirect bare /reports to the first report
  if (location.pathname === '/reports' || location.pathname === '/reports/') {
    return <Navigate to="/reports/general-ledger" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Accounting Reports</h1>
        <p className="text-muted-foreground">Ledgers, statements and analyses for accountants</p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b">
        {reportNav.map(({ name, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
                'hover:text-foreground hover:bg-muted/60',
                isActive
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground border-b-2 border-transparent'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {name}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

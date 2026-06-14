export type Kpi = {
  label: string;
  icon: string;
  value: string;
  unit?: string;
  trend?: string;
  trendIcon?: string;
  badge?: string;
  bar: number;
  barColor: string;
};

export const KPIS: Kpi[] = [
  {
    label: "Active Nodes",
    icon: "router",
    value: "1,248",
    trend: "+12%",
    trendIcon: "trending_up",
    bar: 78,
    barColor: "bg-accent",
  },
  {
    label: "System Load",
    icon: "memory",
    value: "42",
    unit: "%",
    badge: "Stable",
    bar: 42,
    barColor: "bg-accent",
  },
  {
    label: "Data Processed",
    icon: "database",
    value: "8.4",
    unit: "TB",
    trend: "+2.1TB",
    trendIcon: "trending_up",
    bar: 64,
    barColor: "bg-tertiary",
  },
  {
    label: "Uptime",
    icon: "check_circle",
    value: "99.9",
    unit: "%",
    badge: "Optimal",
    bar: 99,
    barColor: "bg-success",
  },
];

export type Activity = {
  icon: string;
  status: "Success" | "Warning" | "System" | "Critical";
  time: string;
  body: { text: string; strong?: string; tail?: string };
};

export const ACTIVITY: Activity[] = [
  {
    icon: "check",
    status: "Success",
    time: "Just now",
    body: {
      text: "Node ",
      strong: "Alpha-7",
      tail: " synchronization complete.",
    },
  },
  {
    icon: "warning",
    status: "Warning",
    time: "12 mins ago",
    body: {
      text: "High latency detected on ",
      strong: "Gateway-B",
      tail: ". Traffic re-routing initiated.",
    },
  },
  {
    icon: "info",
    status: "System",
    time: "1 hour ago",
    body: { text: "Scheduled maintenance snapshot created successfully." },
  },
  {
    icon: "error",
    status: "Critical",
    time: "3 hours ago",
    body: { text: "Authentication server cluster unreachable for 45s." },
  },
];

export type Entity = {
  id: string;
  name: string;
  icon: string;
  type: "Infrastructure" | "Database" | "Network" | "Compute";
  status: "Active" | "Syncing" | "Offline";
  lastActive: string;
  value: string;
};

export const ENTITIES: Entity[] = [
  {
    id: "EN-4921",
    name: "Alpha Node Server",
    icon: "dns",
    type: "Infrastructure",
    status: "Active",
    lastActive: "10 mins ago",
    value: "$45,000",
  },
  {
    id: "EN-4922",
    name: "Customer DB Cluster",
    icon: "database",
    type: "Database",
    status: "Syncing",
    lastActive: "Just now",
    value: "$12,400",
  },
  {
    id: "EN-4923",
    name: "Gateway Protocol Beta",
    icon: "router",
    type: "Network",
    status: "Offline",
    lastActive: "2 hrs ago",
    value: "--",
  },
  {
    id: "EN-4924",
    name: "Logic Processor V2",
    icon: "memory",
    type: "Compute",
    status: "Active",
    lastActive: "1 day ago",
    value: "$8,900",
  },
];

// Throughput series for the performance chart, keyed by time range.
export const THROUGHPUT: Record<string, number[]> = {
  "1H": [3.1, 2.4, 3.8, 5.2, 4.6, 6.1, 7.4, 6.8, 8.2],
  "24H": [2.6, 1.9, 3.4, 4.1, 3.2, 5.6, 4.4, 7.8, 9.4, 8.6],
  "7D": [4.2, 5.1, 4.6, 6.3, 5.8, 7.1, 6.4, 8.0, 7.2, 9.0, 8.1],
};

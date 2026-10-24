import { requireOrg } from "@/lib/auth/session";

/** Every route under /{org} requires a signed-in member of that org (404 otherwise). */
export default async function OrgLayout({ children, params }: LayoutProps<"/[org]">) {
  const { org } = await params;
  await requireOrg(org);
  return children;
}

import { Wordmark } from "@/components/app/wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-5 md:px-8">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 md:items-center md:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

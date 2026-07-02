export default function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="panel mb-4 border-red/40 px-4 py-3">
      <p className="text-[13px] font-medium text-red">{error}</p>
    </div>
  );
}

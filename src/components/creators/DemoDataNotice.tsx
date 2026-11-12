export function DemoDataNotice({
  count,
  demoCount = count,
}: {
  count: number;
  demoCount?: number;
}) {
  return (
    <div className="demo-data-notice" role="note">
      <span className="demo-data-copy"><strong>DEMO DATA —</strong> Fictional sample profiles are not verified; user-added profiles are also unverified.</span>
      <strong>{demoCount} demo · {count} total profiles</strong>
    </div>
  );
}

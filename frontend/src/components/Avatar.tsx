export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  return src ? (
    <img src={src} alt="" referrerPolicy="no-referrer" style={style} className="rounded-full object-cover" />
  ) : (
    <div style={style} className="grid shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-medium text-brand">
      {name[0]?.toUpperCase()}
    </div>
  );
}

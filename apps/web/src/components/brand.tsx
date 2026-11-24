import Link from "next/link";

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="SuccessPro home">
      <span className="brand-mark" aria-hidden="true">★</span>
      <span>
        SuccessPro
        <small style={{ color: dark ? "#4d5d74" : undefined }}>An X Factor Initiative</small>
      </span>
    </Link>
  );
}

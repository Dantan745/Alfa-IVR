import mark from "../assets/cr-mark.png";

/** Знак цифрового рубля. */
export default function CrMark({ size = 64, title }: { size?: number; title?: string }) {
  return (
    <img
      src={mark}
      width={size}
      height={size}
      alt={title || ""}
      aria-hidden={title ? undefined : true}
      draggable={false}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}

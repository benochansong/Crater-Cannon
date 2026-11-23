import type { Field } from "../game/eras";
export function BreakthroughArt({ field }: { field: Field }) {
  if (field === "convoy")
    return (
      <g transform="translate(470 240)" stroke="#203b38" strokeWidth="4">
        <path
          d="M-80 70Q70 0 260 55"
          fill="none"
          stroke="#c4b397"
          strokeWidth="30"
        />
        <path
          d="M-80 70Q70 0 260 55"
          fill="none"
          stroke="#e8d9b2"
          strokeWidth="2"
          strokeDasharray="16 13"
        />
        <g transform="rotate(-5)">
          <rect x="-45" y="-28" width="120" height="68" rx="8" fill="#6f9981" />
          <path d="M75-25H115L142 9V40H75Z" fill="#9db68b" />
          <path d="M88-15H109L126 7H88Z" fill="#bee0d5" />
          {[-16, 25, 103].map((x) => (
            <g key={x}>
              <circle cx={x} cy="42" r="18" fill="#243a3c" />
              <circle cx={x} cy="42" r="9" fill="#a8ae8b" />
            </g>
          ))}
          {[-35, 0, 35].map((x) => (
            <g key={x}>
              <rect x={x} y="-65" width="30" height="37" fill="#c1a574" />
              <path
                d={`M${x + 15}-65V-28M${x}-48H${x + 30}`}
                stroke="#7c6f50"
              />
            </g>
          ))}
        </g>
        <path
          d="M205-20V65M205-20H250V10H205"
          fill="#e7c361"
          stroke="#d4d4b3"
        />
        <text
          x="210"
          y="0"
          fill="#294c44"
          stroke="none"
          fontSize="19"
          fontWeight="bold"
        >
          HQ
        </text>
      </g>
    );
  if (field === "citadel")
    return (
      <g transform="translate(520 250)" stroke="#172d36" strokeWidth="5">
        <path d="M-95-5L-70-52H78L100-5Z" fill="#767b72" />
        <rect x="-102" y="-7" width="206" height="48" rx="21" fill="#263b40" />
        {[-76, -38, 0, 38, 76].map((x) => (
          <circle key={x} cx={x} cy="16" r="15" fill="#9a9c81" />
        ))}
        <rect x="-52" y="-96" width="104" height="49" rx="8" fill="#899080" />
        <path d="M-48-75L-160-102L-167-80L-48-53Z" fill="#a0a28c" />
        <rect x="-177" y="-108" width="26" height="39" fill="#3e5356" />
        {[-83, -43, -3, 37].map((x) => (
          <path key={x} d={`M${x}-44h35l6 31h-42Z`} fill="#b0aa8a" />
        ))}
        <rect x="-78" y="-91" width="22" height="40" fill="#394f50" />
        <rect x="59" y="-91" width="22" height="40" fill="#394f50" />
        <rect x="-39" y="-83" width="25" height="12" fill="#f0bc69" />
        <text
          x="-96"
          y="71"
          fill="#efd49d"
          stroke="none"
          fontSize="22"
          fontWeight="900"
        >
          ARMORED COMMANDER
        </text>
      </g>
    );
  return null;
}

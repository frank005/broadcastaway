/** Official Agora wordmark (from Agora Conversational AI Virtual Avatar demo). */
export default function AgoraLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/agora-logo.png"
      alt="Agora"
      className={`h-10 w-auto object-contain ${className}`.trim()}
    />
  );
}

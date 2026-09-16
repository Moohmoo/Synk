/**
 * Squelette de chargement préservant le ratio 16:9 pour éviter les sauts de mise en page (CLS).
 */
export function Skeleton() {
  return (
    <div className="w-full flex flex-col select-none animate-pulse" aria-busy="true">
      {/* Cadre vidéo 16:9 */}
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#0ac8b9]/40 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>

      {/* Empreinte de la section inférieure méta */}
      <div className="w-full p-4 sm:p-6 flex flex-col gap-4">
        <div className="w-full h-10 rounded-sm bg-white/5" />
        <div className="w-48 h-6 rounded-sm bg-white/5" />
      </div>
    </div>
  );
}

export default Skeleton;

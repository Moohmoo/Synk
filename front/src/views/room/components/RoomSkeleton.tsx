/**
 * Squelette géométrique du salon de lecture :
 * Préserve strictement le ratio 16:9 cinématographique et l'empreinte des contrôles
 * pour garantir zéro décalage de mise en page (CLS) lors du chargement.
 */
export function RoomSkeleton() {
  return (
    <div className="w-full max-w-4xl flex flex-col items-center select-none animate-pulse" aria-busy="true">
      {/* Cadre vidéo 16:9 cinématographique rigoureusement identique à MediaPlayer */}
      <div className="w-full aspect-video rounded-sm border border-white/10 bg-[#0a0a0c] shadow-2xl shadow-black/80 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#0ac8b9]/40 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>

      {/* Empreinte exacte de PlayerControls */}
      <div className="w-full h-14 mt-3 rounded-sm border border-white/10 bg-[#141417]/60 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-white/5" />
          <div className="w-20 h-3.5 rounded-sm bg-white/5" />
        </div>
        <div className="w-48 h-2 rounded-full bg-white/5 hidden sm:block" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-white/5" />
          <div className="w-8 h-8 rounded-sm bg-white/5" />
        </div>
      </div>
    </div>
  );
}

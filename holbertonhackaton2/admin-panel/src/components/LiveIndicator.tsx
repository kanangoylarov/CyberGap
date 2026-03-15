interface LiveIndicatorProps {
  isConnected: boolean;
}

function LiveIndicator({ isConnected }: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </span>
      <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
        {isConnected ? 'Live' : 'Disconnected'}
      </span>
    </div>
  );
}

export default LiveIndicator;

'use client';

import { useState } from 'react';
import { Video, Play, Download, User, Clock, HardDrive, Loader2 } from 'lucide-react';

interface VideoGalleryProps {
  videos: Array<{
    url: string;
    durata: string;
    operatore: string;
    data: Date;
    dimensioneMB: number;
  }>;
}

export default function VideoGallery({ videos }: VideoGalleryProps) {
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  const handleVideoClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async (url: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!url) {
      alert('URL video non disponibile');
      return;
    }

    setDownloadingIndex(index);

    try {
      // Fetch the video as blob to bypass cross-origin restrictions
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create download link with .mp4 extension
      const link = document.createElement('a');
      link.href = blobUrl;
      // Get filename and change extension to .mp4
      let filename = url.split('/').pop() || 'video';
      filename = filename.replace(/\.(webm|mov|avi)$/i, '') + '.mp4';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    } finally {
      setDownloadingIndex(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Video className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Nessun video disponibile</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video, index) => (
        <div
          key={index}
          onClick={() => handleVideoClick(video.url)}
          className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group"
        >
          {/* Video Thumbnail Placeholder */}
          <div className="relative bg-gradient-to-br from-purple-400 to-purple-600 aspect-video flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-all" />
            <Play className="w-16 h-16 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all z-10" />

            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {video.durata}
            </div>
          </div>

          {/* Video Info */}
          <div className="p-4">
            <div className="space-y-2">
              {/* Operator */}
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{video.operatore}</span>
              </div>

              {/* Date */}
              <div className="text-xs text-gray-600">
                {formatDate(video.data)}
              </div>

              {/* Size */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <HardDrive className="w-4 h-4 text-gray-500" />
                <span>{video.dimensioneMB.toFixed(1)} MB</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVideoClick(video.url);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Riproduci
              </button>
              <button
                onClick={(e) => handleDownload(video.url, index, e)}
                disabled={downloadingIndex === index}
                className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                title="Scarica video"
              >
                {downloadingIndex === index ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

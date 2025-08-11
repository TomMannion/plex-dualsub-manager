import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Subtitles } from 'lucide-react';

interface Episode {
  id: string;
  title: string;
  show: string;
  season_episode: string;
  duration?: number;
}

interface Subtitles {
  external_subtitles?: any[];
  embedded_subtitles?: any[];
}

interface EpisodeHeaderProps {
  episode: Episode;
  subtitles?: Subtitles;
}

export const EpisodeHeader: React.FC<EpisodeHeaderProps> = ({
  episode,
  subtitles
}) => {
  return (
    <section className="py-8 border-b border-sage-500/20">
      <div className="px-4 md:px-6 lg:px-8 max-w-full mx-auto">
        <div className="flex items-start gap-4">
          <Link 
            to={`/shows/${episode.show}`} 
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-charcoal-500 border border-gold-500/20 text-gold-500 hover:bg-gold-500 hover:text-black transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-mist-500 mb-2">
              <Link to="/shows" className="hover:text-cream-500 transition-colors">Shows</Link>
              <span>/</span>
              <Link to={`/shows/${episode.show}`} className="hover:text-cream-500 transition-colors">{episode.show}</Link>
              <span>/</span>
              <span className="text-cream-500">{episode.season_episode}</span>
            </div>
            
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-cream-500 mb-2">
              {episode.title}
            </h1>
            
            <div className="flex items-center gap-6 text-sm text-mist-500">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                <span>{episode.season_episode}</span>
              </div>
              {episode.duration && (
                <div className="flex items-center gap-2">
                  <span>{Math.round(episode.duration / 60000)} min</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Subtitles className="w-4 h-4" />
                <span>
                  {subtitles?.external_subtitles?.length || 0} external, {subtitles?.embedded_subtitles?.length || 0} embedded
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
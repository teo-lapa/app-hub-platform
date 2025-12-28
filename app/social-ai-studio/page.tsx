'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft, Home, Sparkles, Upload, Image as ImageIcon,
  Video, Loader2, Download, Instagram, Facebook, Linkedin,
  CheckCircle2, Wand2, MessageSquare, Hash, Target,
  Play, X, Package, Share2, BarChart3, TrendingUp, Award,
  AlertCircle, Zap, Youtube, BookOpen, Search, Lightbulb, Globe,
  Calendar, Clock, FileText, PenTool, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ProductSelector from '@/components/social-ai/ProductSelector';
import ShareMenu from '@/components/social-ai/ShareMenu';
import {
  getSentimentEmoji,
  getRecommendationColor,
  getEngagementLevel
} from '@/lib/social-ai/sentiment-helpers';

type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
type ContentType = 'image' | 'video' | 'both';
type Tone = 'professional' | 'casual' | 'fun' | 'luxury';
type VideoStyle = 'default' | 'zoom' | 'rotate' | 'dynamic' | 'cinematic' | 'explosion' | 'orbital' | 'reassembly';
type VideoDuration = 4 | 6 | 8; // Veo 3.1 supporta solo 4, 6, 8 secondi (massimo 8s)

interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  predictedEngagement: number;
  qualityScore: number;
  strengths: string[];
  improvements: string[];
  recommendation: 'ready_to_post' | 'needs_improvement' | 'regenerate';
}

interface MarketingResult {
  copywriting: {
    caption: string;
    hashtags: string[];
    cta: string;
  };
  sentiment?: SentimentAnalysis;
  image?: {
    dataUrl: string;
  };
  video?: {
    operationId: string;
    status: 'generating' | 'completed';
    dataUrl?: string;
  };
  metadata: {
    platform: string;
    aspectRatio: string;
  };
}

export default function SocialAIStudioPage() {
  // Form states
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('instagram');
  const [contentType, setContentType] = useState<ContentType>('both');
  const [tone, setTone] = useState<Tone>('professional');
  const [targetAudience, setTargetAudience] = useState('');
  const [videoStyle, setVideoStyle] = useState<VideoStyle>('default');
  const [videoDuration, setVideoDuration] = useState<VideoDuration>(6);

  // Branding states
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyMotto, setCompanyMotto] = useState('');

  // Geo-Targeting states
  const [targetCanton, setTargetCanton] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [productCategory, setProductCategory] = useState('');

  // Recipe states
  const [includeRecipe, setIncludeRecipe] = useState(false);
  const [recipeSuggestion, setRecipeSuggestion] = useState(''); // Suggerimento ricetta opzionale
  const [recipeData, setRecipeData] = useState<any | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [isPublishingRecipe, setIsPublishingRecipe] = useState(false);
  const [publishProgress, setPublishProgress] = useState<string[]>([]);

  // YouTube publishing states
  const [isPublishingYouTube, setIsPublishingYouTube] = useState(false);
  const [youtubePublishResult, setYoutubePublishResult] = useState<any | null>(null);

  // Product Story states
  const [includeProductStory, setIncludeProductStory] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storyData, setStoryData] = useState<any | null>(null);
  const [isPublishingStory, setIsPublishingStory] = useState(false);
  const [storyPublishProgress, setStoryPublishProgress] = useState<string[]>([]);

  // Food Curiosity states
  const [includeFoodCuriosity, setIncludeFoodCuriosity] = useState(false);
  const [curiosityTopic, setCuriosityTopic] = useState('');
  const [curiosityCategory, setCuriosityCategory] = useState('');
  const [isSearchingCuriosities, setIsSearchingCuriosities] = useState(false);
  const [curiositiesList, setCuriositiesList] = useState<any[]>([]);
  const [selectedCuriosity, setSelectedCuriosity] = useState<any | null>(null);
  const [isPublishingCuriosity, setIsPublishingCuriosity] = useState(false);
  const [curiosityPublishProgress, setCuriosityPublishProgress] = useState<string[]>([]);

  // Language selection for publishing
  const [publishLanguage, setPublishLanguage] = useState<'it' | 'de' | 'fr' | 'en'>('it');
  const [isTranslatingCuriosity, setIsTranslatingCuriosity] = useState(false);
  const [translatedCuriosity, setTranslatedCuriosity] = useState<any | null>(null);
  const [isGeneratingCuriosityImage, setIsGeneratingCuriosityImage] = useState(false);
  const [curiosityPreviewImage, setCuriosityPreviewImage] = useState<string | null>(null);

  // Free Article states (Idea Libera → Articolo AI)
  const [includeFreeArticle, setIncludeFreeArticle] = useState(false);
  const [freeArticleIdea, setFreeArticleIdea] = useState('');
  const [articleObjective, setArticleObjective] = useState<'blog_seo' | 'inspirational' | 'b2b' | 'storytelling'>('blog_seo');
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [articleData, setArticleData] = useState<any | null>(null);
  const [isPublishingArticle, setIsPublishingArticle] = useState(false);
  const [articlePublishProgress, setArticlePublishProgress] = useState<string[]>([]);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);

  // Article YouTube Video states
  const [isGeneratingArticleVideo, setIsGeneratingArticleVideo] = useState(false);
  const [articleVideoData, setArticleVideoData] = useState<{ operationId?: string; status?: string; dataUrl?: string } | null>(null);
  const [isPollingArticleVideo, setIsPollingArticleVideo] = useState(false);
  const [isPublishingArticleYouTube, setIsPublishingArticleYouTube] = useState(false);
  const [articleYoutubeResult, setArticleYoutubeResult] = useState<any | null>(null);
  const [articleVideoProgress, setArticleVideoProgress] = useState<string[]>([]);

  // Scheduling states
  const [showScheduleModal, setShowScheduleModal] = useState<'curiosity' | 'story' | 'recipe' | 'article' | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [isScheduling, setIsScheduling] = useState(false);

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string[]>([]);
  const [result, setResult] = useState<MarketingResult | null>(null);

  // Video polling
  const [isPollingVideo, setIsPollingVideo] = useState(false);

  // Product Selector
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

  // Share Menu
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // Compressione Immagine (per evitare errori con foto troppo grandi)
  // ==========================================
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calcola le dimensioni target (max 1024px sul lato più lungo)
          const MAX_SIZE = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height;
              height = MAX_SIZE;
            }
          }

          // Crea canvas per ridimensionare
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Impossibile creare il canvas'));
            return;
          }

          // Disegna l'immagine ridimensionata
          ctx.drawImage(img, 0, 0, width, height);

          // Converti in base64 con qualità ridotta (0.8 = 80%)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

          // Calcola la riduzione di dimensione
          const originalSize = (file.size / 1024).toFixed(0);
          const compressedSize = ((compressedBase64.length * 3) / 4 / 1024).toFixed(0);

          console.log(`Compressione: ${originalSize}KB → ${compressedSize}KB (${width}x${height}px)`);

          resolve(compressedBase64);
        };

        img.onerror = () => reject(new Error('Errore nel caricamento dell\'immagine'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Errore nella lettura del file'));
      reader.readAsDataURL(file);
    });
  };

  // ==========================================
  // Product Selector Handler
  // ==========================================
  const handleProductSelect = async (product: any) => {
    // Set product info
    setProductName(product.name);
    setProductDescription(product.description || '');

    // Se c'è un'immagine, usala
    if (product.image) {
      try {
        // Se l'immagine è già base64, usala direttamente
        if (product.image.startsWith('data:image')) {
          setProductImage(product.image);
          setProductImagePreview(product.image);
          toast.success('Prodotto caricato! Foto e info precompilate.');
        } else {
          // Altrimenti converti in base64
          const response = await fetch(product.image);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            setProductImage(base64);
            setProductImagePreview(base64);
            toast.success('Prodotto caricato! Foto e info precompilate.');
          };
          reader.readAsDataURL(blob);
        }
      } catch (error) {
        console.error('Errore caricamento immagine prodotto:', error);
        toast.error('Prodotto caricato, ma impossibile caricare l\'immagine');
      }
    } else {
      toast.success('Prodotto caricato! Carica manualmente una foto.');
    }
  };

  // ==========================================
  // Upload Foto Prodotto
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    try {
      toast.loading('Compressione immagine...');
      const compressedBase64 = await compressImage(file);
      setProductImage(compressedBase64);
      setProductImagePreview(compressedBase64);
      toast.dismiss();
      toast.success('Foto prodotto caricata e ottimizzata!');
    } catch (error: any) {
      console.error('Errore compressione:', error);
      toast.dismiss();
      toast.error('Errore durante la compressione dell\'immagine');
    }
  };

  // ==========================================
  // Upload Logo
  // ==========================================
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido per il logo');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogoImage(base64);
        setLogoPreview(base64);
        toast.success('Logo aziendale caricato!');
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Errore upload logo:', error);
      toast.error('Errore durante il caricamento del logo');
    }
  };

  // ==========================================
  // Load Default Logo
  // ==========================================
  const loadDefaultLogo = async () => {
    try {
      toast.loading('Caricamento logo LAPA...');

      const response = await fetch('/logo-lapa.png');

      if (!response.ok) {
        throw new Error(`Errore nel caricamento: ${response.statusText}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = () => {
        const base64 = reader.result as string;
        setLogoImage(base64);
        setLogoPreview(base64);
        toast.dismiss();
        toast.success('Logo LAPA caricato!');
      };

      reader.onerror = () => {
        toast.dismiss();
        toast.error('Errore nella conversione del logo');
      };

      reader.readAsDataURL(blob);
    } catch (error: any) {
      console.error('Errore caricamento logo predefinito:', error);
      toast.dismiss();
      toast.error(error.message || 'Errore durante il caricamento del logo LAPA');
    }
  };

  // ==========================================
  // Genera Ricetta Tradizionale
  // ==========================================
  const handleGenerateRecipe = async () => {
    if (!productName) {
      toast.error('Inserisci il nome del prodotto prima!');
      return;
    }

    setIsGeneratingRecipe(true);
    setRecipeData(null);

    const loadingToast = toast.loading('Ricerca ricetta tradizionale...');

    try {
      setGenerationProgress(prev => [...prev, '🔍 Ricerca ricetta tradizionale in corso...']);

      const response = await fetch('/api/social-ai/product-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          productDescription: productDescription || undefined,
          productImage: productImage || undefined,
          recipeSuggestion: recipeSuggestion || undefined // Suggerimento opzionale
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante generazione ricetta');
      }

      setRecipeData(data.data);
      setGenerationProgress(prev => [
        ...prev,
        '✅ Ricetta tradizionale trovata!',
        `📍 Regione: ${data.data.recipe.region}`
      ]);

      toast.success('Ricetta generata con successo!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione ricetta:', error);
      toast.error(error.message || 'Errore durante generazione ricetta', { id: loadingToast });
      setGenerationProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  // ==========================================
  // Pubblica Ricetta su Blog + Social
  // ==========================================
  const handlePublishRecipe = async () => {
    if (!recipeData || !productName || !productImage || !recipeData.imageUrl) {
      toast.error('Genera prima la ricetta completa!');
      return;
    }

    setIsPublishingRecipe(true);
    setPublishProgress([]);

    const loadingToast = toast.loading('Pubblicazione in corso...');

    try {
      setPublishProgress(['🚀 Inizio pubblicazione...']);

      const response = await fetch('/api/social-ai/publish-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeData: recipeData.recipe,
          productName,
          productImage,
          recipeImage: recipeData.imageUrl,
          sources: recipeData.sources || []
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione');
      }

      // Mostra progresso basato su risultati REALI dall'API
      const progressMessages: string[] = [];

      // Check traduzioni (se ci sono translations nella response)
      if (data.data?.translations && data.data.translations.length > 0) {
        progressMessages.push(`✅ Ricetta tradotta in ${data.data.translations.length} lingue!`);
      }

      // Check immagini (se ci sono image IDs nella response)
      if (data.data?.images) {
        progressMessages.push('✅ Immagini caricate su Odoo!');
      }

      // Check blog posts (se ci sono blog post IDs)
      if (data.data?.blogPosts && Object.keys(data.data.blogPosts).length > 0) {
        progressMessages.push(`✅ ${Object.keys(data.data.blogPosts).length} Blog post creati!`);
      }

      // Check social posts
      if (data.data?.stats) {
        const { successfulSocialPublishes, failedSocialPublishes } = data.data.stats;

        if (successfulSocialPublishes > 0) {
          // 1 post pubblicato sui 4 account
          progressMessages.push('✅ Post social pubblicato su Facebook, Instagram, LinkedIn, Twitter');
        }

        if (failedSocialPublishes > 0) {
          progressMessages.push('❌ Pubblicazione social fallita');

          // Mostra dettagli failures se disponibili
          if (data.data?.socialPublishFailures) {
            data.data.socialPublishFailures.forEach((failure: string) => {
              progressMessages.push(`  ${failure}`);
            });
          }
        }
      }

      // Messaggio finale
      if (data.success) {
        progressMessages.push('🎉 Pubblicazione completata con successo!');
        toast.success('Ricetta pubblicata con successo su Blog e Social!', { id: loadingToast });
      } else if (data.warning) {
        progressMessages.push(`⚠️ ${data.warning}`);
        toast(data.warning, { id: loadingToast, duration: 6000, icon: '⚠️' });
      }

      setPublishProgress(prev => [...prev, ...progressMessages]);

      // Mostra risultati
      console.log('Blog posts creati:', data.data.blogPosts);
      console.log('Post social:', data.data.socialPosts);
      console.log('Stats:', data.data.stats);

    } catch (error: any) {
      console.error('Errore pubblicazione:', error);
      toast.error(error.message || 'Errore durante pubblicazione', { id: loadingToast });
      setPublishProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsPublishingRecipe(false);
    }
  };

  // ==========================================
  // Genera Storia Prodotto
  // ==========================================
  const handleGenerateStory = async () => {
    if (!productName) {
      toast.error('Inserisci il nome del prodotto prima!');
      return;
    }

    setIsGeneratingStory(true);
    setStoryData(null);

    const loadingToast = toast.loading('Ricerca storia e origine prodotto...');

    try {
      const response = await fetch('/api/social-ai/product-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          productDescription: productDescription || undefined,
          productImage: productImage || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante generazione storia');
      }

      setStoryData(data.data);
      toast.success('Storia prodotto generata!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione storia:', error);
      toast.error(error.message || 'Errore durante generazione storia', { id: loadingToast });
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // ==========================================
  // Pubblica Storia Prodotto su Blog + Social
  // ==========================================
  const handlePublishStory = async () => {
    if (!storyData || !productName) {
      toast.error('Genera prima la storia del prodotto!');
      return;
    }

    if (!storyData.story) {
      toast.error('Dati storia non trovati! Rigenera la storia.');
      return;
    }

    if (!productImage) {
      toast.error('Carica prima l\'immagine del prodotto!');
      return;
    }

    if (!storyData.imageUrl) {
      toast.error('Immagine storia non generata! Rigenera la storia.');
      return;
    }

    setIsPublishingStory(true);
    setStoryPublishProgress([]);

    const loadingToast = toast.loading('Pubblicazione storia in corso...');

    try {
      setStoryPublishProgress(['🚀 Inizio pubblicazione storia...']);

      const response = await fetch('/api/social-ai/publish-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyData: storyData.story,
          productName,
          productImage: productImage,
          storyImage: storyData.imageUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione');
      }

      const progressMessages: string[] = [];

      if (data.data?.translations) {
        progressMessages.push(`✅ Storia tradotta in ${data.data.translations.length} lingue!`);
      }

      if (data.data?.blogPostId) {
        progressMessages.push('✅ Blog post creato!');
      }

      if (data.data?.socialPosts) {
        progressMessages.push('✅ Post social pubblicati!');
      }

      progressMessages.push('🎉 Pubblicazione storia completata!');
      setStoryPublishProgress(prev => [...prev, ...progressMessages]);

      toast.success('Storia pubblicata su Blog e Social!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore pubblicazione storia:', error);
      toast.error(error.message || 'Errore durante pubblicazione', { id: loadingToast });
      setStoryPublishProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsPublishingStory(false);
    }
  };

  // ==========================================
  // Cerca Curiosità Food
  // ==========================================
  const handleSearchCuriosities = async () => {
    setIsSearchingCuriosities(true);
    setCuriositiesList([]);
    setSelectedCuriosity(null);

    const loadingToast = toast.loading('Ricerca curiosità food in corso...');

    try {
      const response = await fetch('/api/social-ai/food-curiosity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: curiosityTopic || undefined,
          category: curiosityCategory || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante ricerca curiosità');
      }

      setCuriositiesList(data.data.curiosities || []);
      toast.success(`Trovate ${data.data.curiosities.length} curiosità!`, { id: loadingToast });

    } catch (error: any) {
      console.error('Errore ricerca curiosità:', error);
      toast.error(error.message || 'Errore durante ricerca', { id: loadingToast });
    } finally {
      setIsSearchingCuriosities(false);
    }
  };

  // ==========================================
  // Genera Anteprima Immagine Curiosità
  // ==========================================
  const handleGenerateCuriosityPreview = async () => {
    if (!selectedCuriosity) {
      toast.error('Seleziona una curiosità prima!');
      return;
    }

    setIsGeneratingCuriosityImage(true);
    setCuriosityPreviewImage(null);

    const loadingToast = toast.loading('Generazione immagine AI in corso...');

    try {
      const response = await fetch('/api/social-ai/generate-curiosity-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: selectedCuriosity.imagePrompt,
          title: selectedCuriosity.title
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante generazione immagine');
      }

      setCuriosityPreviewImage(data.data.imageUrl);
      toast.success('Immagine generata! Ora puoi pubblicare.', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione immagine:', error);
      toast.error(error.message || 'Errore durante generazione', { id: loadingToast });
    } finally {
      setIsGeneratingCuriosityImage(false);
    }
  };

  // ==========================================
  // Traduci Curiosità
  // ==========================================
  const handleTranslateCuriosity = async () => {
    if (!selectedCuriosity) {
      toast.error('Seleziona una curiosità prima!');
      return;
    }

    if (publishLanguage === 'it') {
      // Se italiano, usa il contenuto originale
      setTranslatedCuriosity(null);
      return;
    }

    setIsTranslatingCuriosity(true);
    const loadingToast = toast.loading('Traduzione in corso...');

    try {
      const response = await fetch('/api/social-ai/translate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            title: selectedCuriosity.title,
            fullContent: selectedCuriosity.fullContent,
            socialCaption: selectedCuriosity.socialCaption,
            hashtags: selectedCuriosity.hashtags
          },
          targetLanguage: publishLanguage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante traduzione');
      }

      setTranslatedCuriosity(data.data);
      toast.success('Contenuto tradotto!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore traduzione:', error);
      toast.error(error.message || 'Errore durante traduzione', { id: loadingToast });
    } finally {
      setIsTranslatingCuriosity(false);
    }
  };

  // ==========================================
  // Pubblica Curiosità sui Social
  // ==========================================
  const handlePublishCuriosity = async () => {
    if (!selectedCuriosity) {
      toast.error('Seleziona una curiosità prima!');
      return;
    }

    if (!curiosityPreviewImage) {
      toast.error('Genera prima l\'anteprima dell\'immagine!');
      return;
    }

    // Se lingua non è italiano e non c'è traduzione, avvisa l'utente
    if (publishLanguage !== 'it' && !translatedCuriosity) {
      toast.error('Traduci prima il contenuto nella lingua selezionata!');
      return;
    }

    setIsPublishingCuriosity(true);
    setCuriosityPublishProgress([]);

    const langNames: Record<string, string> = {
      it: 'italiano',
      de: 'tedesco',
      fr: 'francese',
      en: 'inglese'
    };

    const loadingToast = toast.loading(`Pubblicazione in ${langNames[publishLanguage]}...`);

    try {
      setCuriosityPublishProgress([`🚀 Pubblicazione curiosità in ${langNames[publishLanguage]}...`]);

      // Usa contenuto tradotto se disponibile, altrimenti originale
      const curiosityToPublish = translatedCuriosity ? {
        ...selectedCuriosity,
        title: translatedCuriosity.title,
        fullContent: translatedCuriosity.fullContent,
        socialCaption: translatedCuriosity.socialCaption,
        hashtags: translatedCuriosity.hashtags
      } : selectedCuriosity;

      const response = await fetch('/api/social-ai/publish-curiosity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curiosity: curiosityToPublish,
          generateImage: false, // Immagine già generata
          customImage: curiosityPreviewImage // Usa l'immagine già generata
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione');
      }

      const progressMessages: string[] = [];

      if (data.data?.imageId) {
        progressMessages.push('✅ Immagine caricata!');
      }

      if (data.data?.socialPostIds?.length > 0) {
        progressMessages.push(`✅ Pubblicato su ${data.data.platforms.join(', ')}!`);
      }

      progressMessages.push('🎉 Curiosità pubblicata con successo!');
      setCuriosityPublishProgress(prev => [...prev, ...progressMessages]);

      toast.success('Curiosità pubblicata sui social!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore pubblicazione curiosità:', error);
      toast.error(error.message || 'Errore durante pubblicazione', { id: loadingToast });
      setCuriosityPublishProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsPublishingCuriosity(false);
    }
  };

  // ==========================================
  // Programmazione Post sui Social
  // ==========================================
  const handleSchedulePost = async (type: 'curiosity' | 'story' | 'recipe' | 'article') => {
    if (!scheduledDate || !scheduledTime) {
      toast.error('Seleziona data e ora per la programmazione!');
      return;
    }

    // Combina data e ora in formato ISO
    const scheduledDateTime = `${scheduledDate} ${scheduledTime}:00`;

    setIsScheduling(true);
    const loadingToast = toast.loading('Programmazione post in corso...');

    try {
      let response;
      let endpoint;
      let body;

      if (type === 'curiosity') {
        if (!selectedCuriosity || !curiosityPreviewImage) {
          toast.error('Seleziona una curiosità e genera l\'anteprima prima!');
          setIsScheduling(false);
          toast.dismiss(loadingToast);
          return;
        }

        // Usa contenuto tradotto se disponibile
        const curiosityToPublish = translatedCuriosity ? {
          ...selectedCuriosity,
          title: translatedCuriosity.title,
          fullContent: translatedCuriosity.fullContent,
          socialCaption: translatedCuriosity.socialCaption,
          hashtags: translatedCuriosity.hashtags
        } : selectedCuriosity;

        endpoint = '/api/social-ai/publish-curiosity';
        body = {
          curiosity: curiosityToPublish,
          generateImage: false,
          customImage: curiosityPreviewImage,
          scheduledDate: scheduledDateTime
        };
      } else if (type === 'story') {
        if (!storyData?.story || !productImage || !storyData?.imageUrl) {
          toast.error('Genera prima la storia del prodotto!');
          setIsScheduling(false);
          toast.dismiss(loadingToast);
          return;
        }

        endpoint = '/api/social-ai/publish-story';
        body = {
          storyData: storyData.story,
          productName,
          productImage,
          storyImage: storyData.imageUrl,
          scheduledDate: scheduledDateTime
        };
      } else if (type === 'recipe') {
        if (!recipeData || !productName || !productImage || !recipeData.imageUrl) {
          toast.error('Genera prima la ricetta completa!');
          setIsScheduling(false);
          toast.dismiss(loadingToast);
          return;
        }

        endpoint = '/api/social-ai/publish-recipe';
        body = {
          recipeData: recipeData.recipe,
          productName,
          productImage,
          recipeImage: recipeData.imageUrl,
          sources: recipeData.sources || [],
          scheduledDate: scheduledDateTime
        };
      } else if (type === 'article') {
        if (!articleData || !articleData.imageUrl) {
          toast.error('Genera prima l\'articolo completo!');
          setIsScheduling(false);
          toast.dismiss(loadingToast);
          return;
        }

        endpoint = '/api/social-ai/publish-article';
        body = {
          articleData: articleData.article,
          articleImage: articleData.imageUrl,
          productName: productName || undefined,
          productImage: productImage || undefined,
          scheduledDate: scheduledDateTime
        };
      }

      response = await fetch(endpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante programmazione');
      }

      toast.success(`Post programmato per ${scheduledDate} alle ${scheduledTime}!`, { id: loadingToast });
      setShowScheduleModal(null);
      setScheduledDate('');
      setScheduledTime('');

    } catch (error: any) {
      console.error('Errore programmazione:', error);
      toast.error(error.message || 'Errore durante programmazione', { id: loadingToast });
    } finally {
      setIsScheduling(false);
    }
  };

  // ==========================================
  // Genera Articolo da Idea Libera
  // ==========================================
  const handleGenerateArticle = async () => {
    if (!freeArticleIdea || freeArticleIdea.trim().length < 10) {
      toast.error('Inserisci un\'idea di almeno 10 caratteri!');
      return;
    }

    setIsGeneratingArticle(true);
    setArticleData(null);

    const loadingToast = toast.loading('Generazione articolo in corso...');

    try {
      const response = await fetch('/api/social-ai/free-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: freeArticleIdea,
          objective: articleObjective,
          tone,
          targetAudience: targetAudience || undefined,
          productName: productName || undefined,
          productImage: productImage || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante generazione articolo');
      }

      setArticleData(data.data);
      toast.success('Articolo generato con successo!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione articolo:', error);
      toast.error(error.message || 'Errore durante generazione articolo', { id: loadingToast });
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  // ==========================================
  // Pubblica Articolo su Blog + Social
  // ==========================================
  const handlePublishArticle = async () => {
    if (!articleData || !articleData.imageUrl) {
      toast.error('Genera prima l\'articolo completo!');
      return;
    }

    setIsPublishingArticle(true);
    setArticlePublishProgress([]);

    const loadingToast = toast.loading('Pubblicazione in corso...');

    try {
      setArticlePublishProgress(['🚀 Inizio pubblicazione...']);

      const response = await fetch('/api/social-ai/publish-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleData: articleData.article,
          articleImage: articleData.imageUrl,
          productName: productName || undefined,
          productImage: productImage || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione');
      }

      const progressMessages: string[] = [];

      if (data.data?.translations && data.data.translations.length > 0) {
        progressMessages.push(`✅ Articolo tradotto in ${data.data.translations.length} lingue!`);
      }

      if (data.data?.blogPostId) {
        progressMessages.push('✅ Blog post creato!');
      }

      if (data.data?.socialPostIds && data.data.socialPostIds.length > 0) {
        progressMessages.push(`✅ ${data.data.socialPostIds.length} post social pubblicati!`);
      }

      if (data.data?.blogPostUrl) {
        progressMessages.push(`📍 URL: ${data.data.blogPostUrl}`);
        // Salva l'URL del blog in articleData per usarlo nel video YouTube
        setArticleData((prev: any) => ({
          ...prev,
          blogPostUrl: data.data.blogPostUrl,
          isPublished: true
        }));
      }

      progressMessages.push('🎉 Pubblicazione completata con successo!');

      setArticlePublishProgress(prev => [...prev, ...progressMessages]);
      toast.success('Articolo pubblicato su Blog e Social!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore pubblicazione articolo:', error);
      toast.error(error.message || 'Errore durante pubblicazione', { id: loadingToast });
      setArticlePublishProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsPublishingArticle(false);
    }
  };

  // ==========================================
  // Rigenera Immagine Articolo
  // ==========================================
  const handleRegenerateArticleImage = async () => {
    if (!articleData || !articleData.article) {
      toast.error('Nessun articolo da cui rigenerare l\'immagine');
      return;
    }

    setIsRegeneratingImage(true);
    const loadingToast = toast.loading('Rigenerando immagine...');

    try {
      const response = await fetch('/api/social-ai/regenerate-article-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleTitle: articleData.article.title,
          articleSubtitle: articleData.article.subtitle,
          imagePrompt: articleData.article.imagePrompt || `Professional editorial photo for article about: ${articleData.article.title}`,
          productImage: productImage || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante rigenerazione');
      }

      // Aggiorna solo l'immagine nell'articleData
      setArticleData((prev: any) => ({
        ...prev,
        imageUrl: data.imageUrl
      }));

      toast.success('Immagine rigenerata!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore rigenerazione immagine:', error);
      toast.error(error.message || 'Errore durante rigenerazione', { id: loadingToast });
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  // ==========================================
  // Aggiorna Campo Articolo (per editing inline)
  // ==========================================
  const updateArticleField = (field: string, value: any) => {
    setArticleData((prev: any) => ({
      ...prev,
      article: {
        ...prev.article,
        [field]: value
      }
    }));
  };

  const updateArticleSection = (index: number, field: 'title' | 'content', value: string) => {
    setArticleData((prev: any) => {
      const newSections = [...prev.article.sections];
      newSections[index] = {
        ...newSections[index],
        [field]: value
      };
      return {
        ...prev,
        article: {
          ...prev.article,
          sections: newSections
        }
      };
    });
  };

  // ==========================================
  // Genera Video YouTube dall'Articolo
  // ==========================================
  const handleGenerateArticleVideo = async () => {
    if (!articleData || !articleData.imageUrl) {
      toast.error('Genera prima l\'articolo con immagine!');
      return;
    }

    setIsGeneratingArticleVideo(true);
    setArticleVideoProgress(['🎬 Avvio generazione video...']);
    const loadingToast = toast.loading('Generazione video in corso...');

    try {
      // Usa generate-marketing con contentType='video' e l'immagine dell'articolo
      // Usiamo 'linkedin' perché ha aspect ratio 16:9, perfetto per YouTube
      const response = await fetch('/api/social-ai/generate-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage: articleData.imageUrl,
          productName: articleData.article.title,
          productDescription: articleData.article.introduction,
          socialPlatform: 'linkedin', // 16:9 aspect ratio, perfetto per YouTube
          contentType: 'video',
          tone: tone,
          targetAudience: targetAudience || 'Ristoratori, chef, food lovers',
          videoStyle: 'cinematic',
          videoDuration: 8
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante generazione video');
      }

      setArticleVideoProgress(prev => [...prev, '⏳ Video in generazione con Veo 3.1...']);

      // Controlla se c'è un video in generazione
      if (data.data?.video?.operationId && data.data.video.status === 'generating') {
        setArticleVideoData({
          operationId: data.data.video.operationId,
          status: 'generating'
        });
        toast.success('Video in generazione...', { id: loadingToast });
        startArticleVideoPolling(data.data.video.operationId);
      } else {
        throw new Error('Generazione video non avviata');
      }

    } catch (error: any) {
      console.error('Errore generazione video articolo:', error);
      toast.error(error.message || 'Errore durante generazione video', { id: loadingToast });
      setArticleVideoProgress(prev => [...prev, '❌ Errore: ' + error.message]);
      setIsGeneratingArticleVideo(false);
    }
  };

  // Polling Video Articolo
  const startArticleVideoPolling = async (operationId: string) => {
    if (!operationId || operationId.trim().length === 0) {
      console.error('operationId non valido');
      setIsGeneratingArticleVideo(false);
      return;
    }

    setIsPollingArticleVideo(true);
    const maxAttempts = 120;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch('/api/social-ai/check-video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationId })
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Errore video polling:', data.error);
          setArticleVideoProgress(prev => [...prev, '❌ Polling fallito: ' + data.error]);
          setIsPollingArticleVideo(false);
          setIsGeneratingArticleVideo(false);
          return;
        }

        if (data.done && data.video) {
          // Video completato!
          setArticleVideoData(prev => ({
            ...prev,
            status: 'completed',
            dataUrl: data.video.dataUrl
          }));
          setArticleVideoProgress(prev => [...prev, '✅ Video completato!']);
          toast.success('Video generato con successo!');
          setIsPollingArticleVideo(false);
          setIsGeneratingArticleVideo(false);
          return;
        }

        // Continua polling
        attempts++;
        const progress = data.progress || Math.round((attempts / maxAttempts) * 100);
        setArticleVideoProgress(prev => {
          const filtered = prev.filter(p => !p.includes('Progresso:'));
          return [...filtered, `⏳ Progresso: ${progress}%`];
        });

        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          toast.error('Timeout: il video sta impiegando troppo tempo');
          setIsPollingArticleVideo(false);
          setIsGeneratingArticleVideo(false);
        }

      } catch (error) {
        console.error('Errore polling video:', error);
        setIsPollingArticleVideo(false);
        setIsGeneratingArticleVideo(false);
      }
    };

    poll();
  };

  // ==========================================
  // Pubblica Video Articolo su YouTube
  // ==========================================
  const handlePublishArticleYouTube = async () => {
    if (!articleVideoData?.dataUrl) {
      toast.error('Genera prima il video!');
      return;
    }

    if (!articleData?.article) {
      toast.error('Dati articolo non disponibili');
      return;
    }

    setIsPublishingArticleYouTube(true);
    const loadingToast = toast.loading('Pubblicazione su YouTube in corso...');

    try {
      // Costruisci caption con link all'articolo
      const articleUrl = articleData.blogPostUrl || 'https://www.lapa.ch/blog';
      const caption = `${articleData.article.title}

${articleData.article.introduction.substring(0, 300)}...

📖 Leggi l'articolo completo: ${articleUrl}

${articleData.article.socialSuggestions?.hashtags?.slice(0, 5).join(' ') || '#LAPA #ItalianFood'}`;

      const response = await fetch('/api/social-ai/publish-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoDataUrl: articleVideoData.dataUrl,
          productName: articleData.article.title,
          productDescription: articleData.article.subtitle,
          caption: caption,
          hashtags: articleData.article.socialSuggestions?.hashtags || ['#LAPA', '#ItalianFood', '#Gourmet']
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione YouTube');
      }

      setArticleYoutubeResult(data.data);

      toast.success(
        <div>
          <div className="font-bold">Video pubblicato su YouTube!</div>
          <div className="text-sm mt-1">{data.data.youtubeTitle}</div>
        </div>,
        { id: loadingToast, duration: 6000 }
      );

    } catch (error: any) {
      console.error('Errore pubblicazione YouTube:', error);
      toast.error(error.message || 'Errore durante pubblicazione', { id: loadingToast });
    } finally {
      setIsPublishingArticleYouTube(false);
    }
  };

  // Helper per aprire il modal di scheduling
  const openScheduleModal = (type: 'curiosity' | 'story' | 'recipe' | 'article') => {
    // Imposta data/ora di default: domani alle 10:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setScheduledTime('10:00');
    setShowScheduleModal(type);
  };

  // ==========================================
  // Genera Contenuti Marketing
  // ==========================================
  const handleGenerate = async () => {
    if (!productImage) {
      toast.error('Carica una foto del prodotto prima!');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress([]);
    setResult(null);

    // Se abilitata, genera anche la ricetta
    if (includeRecipe && productName) {
      await handleGenerateRecipe();
    }

    const loadingToast = toast.loading('Avvio agenti AI...');

    try {
      // Progress updates
      setGenerationProgress(['🚀 Inizializzazione agenti in parallelo...']);

      const response = await fetch('/api/social-ai/generate-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage,
          productName: productName || undefined,
          productDescription: productDescription || undefined,
          socialPlatform,
          contentType,
          tone,
          targetAudience: targetAudience || undefined,
          videoStyle: videoStyle || 'default',
          videoDuration: videoDuration || 6,
          // Branding
          includeLogo,
          logoImage: logoImage || undefined,
          companyMotto: companyMotto || undefined,
          // Geo-Targeting & RAG
          productCategory: productCategory || undefined,
          targetCanton: targetCanton || undefined,
          targetCity: targetCity || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la generazione');
      }

      setGenerationProgress(prev => [
        ...prev,
        '✅ Copywriting completato',
        contentType !== 'video' ? '✅ Immagine generata con Nano Banana 🍌' : '',
        contentType !== 'image' ? '⏳ Video in generazione con Veo 3.1...' : ''
      ].filter(Boolean));

      setResult(data.data);

      // Se c'è un video in generazione, avvia il polling
      const hasValidVideoOperation = data.data.video?.operationId &&
                                      data.data.video.operationId.length > 0 &&
                                      data.data.video.status === 'generating';

      if (hasValidVideoOperation) {
        console.log('✅ Video operation ID valido, avvio polling:', data.data.video.operationId);
        toast.success('Copy e immagine pronti! Video in generazione...', { id: loadingToast });
        startVideoPolling(data.data.video.operationId);
      } else if (contentType === 'video' || contentType === 'both') {
        // Se era richiesto un video ma non è stato generato
        console.log('⚠️ Video richiesto ma non generato:', data.data.video);
        toast.success('Copy e immagine pronti! (Video non disponibile)', { id: loadingToast });
        setGenerationProgress(prev => [...prev, '⚠️ Video generation non disponibile al momento']);
      } else {
        toast.success('Contenuti marketing generati con successo!', { id: loadingToast });
      }

    } catch (error: any) {
      console.error('Errore:', error);
      toast.error(error.message || 'Errore durante la generazione', { id: loadingToast });
      setGenerationProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================
  // Polling Video
  // ==========================================
  const startVideoPolling = async (operationId: string) => {
    // Validazione operationId
    if (!operationId || operationId.trim().length === 0) {
      console.error('❌ operationId non valido, skip polling');
      setIsPollingVideo(false);
      return;
    }

    setIsPollingVideo(true);
    const maxAttempts = 120; // 10 minuti max (ogni 5 secondi) - per video lunghi fino a 30s
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch('/api/social-ai/check-video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationId })
        });

        const data = await response.json();

        // Se c'è un errore 500, ferma il polling
        if (!response.ok) {
          console.error('❌ Errore video polling:', data.error);
          setGenerationProgress(prev => [...prev, `❌ Video polling fallito: ${data.error || 'Errore sconosciuto'}`]);
          setIsPollingVideo(false);
          return;
        }

        if (data.done && data.video) {
          // Video completato!
          setResult(prev => prev ? {
            ...prev,
            video: {
              ...prev.video!,
              status: 'completed',
              dataUrl: data.video.dataUrl
            }
          } : null);

          setGenerationProgress(prev => [...prev, '✅ Video completato!']);
          toast.success('Video marketing generato con successo!');
          setIsPollingVideo(false);
          return;
        }

        // Continua polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Riprova dopo 5 secondi
        } else {
          toast.error('Timeout: il video sta impiegando troppo tempo');
          setIsPollingVideo(false);
        }

      } catch (error) {
        console.error('Errore polling video:', error);
        setIsPollingVideo(false);
      }
    };

    poll();
  };

  // ==========================================
  // Download
  // ==========================================
  const handleDownloadImage = () => {
    if (!result?.image?.dataUrl) return;

    const link = document.createElement('a');
    link.href = result.image.dataUrl;
    link.download = `marketing-${socialPlatform}-${Date.now()}.png`;
    link.click();
    toast.success('Download immagine avviato!');
  };

  const handleDownloadVideo = () => {
    if (!result?.video?.dataUrl) return;

    const link = document.createElement('a');
    link.href = result.video.dataUrl;
    link.download = `marketing-${socialPlatform}-${Date.now()}.mp4`;
    link.click();
    toast.success('Download video avviato!');
  };

  // ==========================================
  // Pubblica Video su YouTube
  // ==========================================
  const handlePublishYouTube = async () => {
    if (!result?.video?.dataUrl || !result?.copywriting) {
      toast.error('Video o copywriting non disponibili');
      return;
    }

    if (!productName) {
      toast.error('Nome prodotto richiesto');
      return;
    }

    setIsPublishingYouTube(true);
    const loadingToast = toast.loading('Pubblicazione su YouTube in corso...');

    try {
      console.log('[YouTube] Starting publication...');

      const response = await fetch('/api/social-ai/publish-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoDataUrl: result.video.dataUrl,
          productName,
          productDescription: productDescription || undefined,
          caption: result.copywriting.caption,
          hashtags: result.copywriting.hashtags
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione YouTube');
      }

      setYoutubePublishResult(data.data);

      toast.success(
        <div>
          <div className="font-bold">Video pubblicato su YouTube! 🎉</div>
          <div className="text-sm mt-1">{data.data.youtubeTitle}</div>
        </div>,
        { id: loadingToast, duration: 6000 }
      );

      console.log('[YouTube] Published successfully:', data.data);

    } catch (error: any) {
      console.error('[YouTube] Publish error:', error);
      toast.error(error.message || 'Errore durante pubblicazione YouTube', {
        id: loadingToast
      });
    } finally {
      setIsPublishingYouTube(false);
    }
  };

  // ==========================================
  // Platform Icons
  // ==========================================
  const platformIcons: Record<SocialPlatform, any> = {
    instagram: Instagram,
    facebook: Facebook,
    tiktok: Video,
    linkedin: Linkedin
  };

  const PlatformIcon = platformIcons[socialPlatform];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-purple-500/30 transition-colors group"
                >
                  <ArrowLeft className="h-5 w-5 text-purple-300 group-hover:text-white" />
                  <Home className="h-5 w-5 text-purple-300 group-hover:text-white" />
                  <span className="text-purple-300 group-hover:text-white font-medium">Home</span>
                </Link>

                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-3 rounded-xl">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Social Marketing AI Studio</h1>
                    <p className="text-xs sm:text-sm text-purple-300">
                      Powered by Gemini 2.5 Flash (Nano Banana 🍌) & Veo 3.1
                    </p>
                  </div>
                </div>
              </div>

              {/* Analytics Button */}
              <Link
                href="/social-ai-studio/analytics"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg transition-all group shadow-lg"
              >
                <BarChart3 className="h-5 w-5 text-white" />
                <span className="text-white font-medium hidden sm:inline">Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">

          {/* ========================================== */}
          {/* COLONNA SINISTRA: Configurazione */}
          {/* ========================================== */}
          <div className="space-y-4 sm:space-y-6">

            {/* Upload Foto Prodotto */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-3 flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Foto Prodotto/Processo</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isGenerating}
                className="hidden"
              />

              {/* Pulsante Scegli dal Catalogo */}
              <button
                onClick={() => setIsProductSelectorOpen(true)}
                disabled={isGenerating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 sm:py-4 min-h-[48px] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 border border-emerald-400/50 rounded-lg text-white font-medium transition-all disabled:opacity-50 mb-3"
              >
                <Package className="h-5 w-5" />
                <span className="text-sm sm:text-base">Scegli Prodotto dal Catalogo</span>
              </button>

              {/* Oppure carica foto */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-purple-500/30"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-slate-800/40 text-purple-400">oppure</span>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 sm:py-4 min-h-[48px] bg-slate-900/50 hover:bg-slate-700/50 border border-purple-500/50 hover:border-purple-400 rounded-lg text-purple-300 hover:text-white transition-all disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm sm:text-base">Carica Foto Manualmente</span>
              </button>

              {productImagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={productImagePreview}
                    alt="Prodotto"
                    className="w-full h-auto max-h-[200px] sm:max-h-[300px] object-contain rounded-lg border border-purple-500/50"
                  />
                  <button
                    onClick={() => {
                      setProductImage(null);
                      setProductImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="mt-2 text-xs text-emerald-400 text-center">
                    ✓ Foto caricata
                  </div>
                </div>
              )}
            </div>

            {/* Info Prodotto */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-2">
                Nome Prodotto (opzionale)
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Es: Caffè Premium Arabica"
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500"
                disabled={isGenerating}
              />

              <label className="block text-sm font-medium text-purple-300 mb-2 mt-4">
                Descrizione (opzionale)
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Breve descrizione del prodotto..."
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 min-h-[80px] resize-none"
                disabled={isGenerating}
              />
            </div>

            {/* Branding Aziendale */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-purple-300">
                  Branding Aziendale
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e) => setIncludeLogo(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded border-purple-500/50 bg-slate-900/50 text-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-purple-300">Includi logo/motto</span>
                </label>
              </div>

              {includeLogo && (
                <>
                  {/* Upload Logo */}
                  <div className="mb-4">
                    <label className="block text-xs text-purple-300 mb-2">
                      Logo Aziendale (opzionale)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={handleLogoUpload}
                        disabled={isGenerating}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg hover:border-purple-400 transition-colors cursor-pointer text-sm text-purple-300"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Carica Logo</span>
                      </label>

                      {/* Usa Logo LAPA Button */}
                      <button
                        onClick={loadDefaultLogo}
                        disabled={isGenerating}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border border-purple-400/50 rounded-lg transition-all cursor-pointer text-sm text-white font-medium disabled:opacity-50"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Usa logo LAPA</span>
                      </button>
                    </div>

                    {logoPreview && (
                      <div className="mt-2 relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-16 w-auto object-contain rounded border border-purple-500/50 bg-white/5 p-2"
                        />
                        <button
                          onClick={() => {
                            setLogoImage(null);
                            setLogoPreview(null);
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Motto Aziendale */}
                  <div>
                    <label className="block text-xs text-purple-300 mb-2">
                      Motto/Slogan (opzionale)
                    </label>
                    <input
                      type="text"
                      value={companyMotto}
                      onChange={(e) => setCompanyMotto(e.target.value)}
                      placeholder="Es: Qualità Italiana dal 1950"
                      maxLength={100}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 text-sm"
                      disabled={isGenerating}
                    />
                    <div className="text-xs text-slate-500 mt-1 text-right">
                      {companyMotto.length}/100
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Social Platform */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-3">
                Piattaforma Social
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['instagram', 'facebook', 'tiktok', 'linkedin'] as SocialPlatform[]).map((platform) => {
                  const Icon = platformIcons[platform];
                  return (
                    <button
                      key={platform}
                      onClick={() => setSocialPlatform(platform)}
                      disabled={isGenerating}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all ${
                        socialPlatform === platform
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                          : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                      } disabled:opacity-50 capitalize`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{platform}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Type */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-3">
                Tipo Contenuto
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['image', 'video', 'both'] as ContentType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setContentType(type)}
                    disabled={isGenerating}
                    className={`px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all ${
                      contentType === type
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50 capitalize`}
                  >
                    {type === 'image' && <ImageIcon className="h-5 w-5 mx-auto mb-1" />}
                    {type === 'video' && <Video className="h-5 w-5 mx-auto mb-1" />}
                    {type === 'both' && <Sparkles className="h-5 w-5 mx-auto mb-1" />}
                    {type === 'both' ? 'Entrambi' : type === 'image' ? 'Foto' : 'Video'}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Style - mostra solo se video o both */}
            {(contentType === 'video' || contentType === 'both') && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
                <label className="block text-sm font-medium text-purple-300 mb-3">
                  Stile Video
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setVideoStyle('default')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'default'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Standard</div>
                    <div className="text-xs opacity-75">Movimento naturale</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('zoom')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'zoom'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Zoom In</div>
                    <div className="text-xs opacity-75">Avvicinamento lento</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('rotate')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'rotate'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Rotazione 360°</div>
                    <div className="text-xs opacity-75">Gira intorno prodotto</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('dynamic')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'dynamic'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Dinamico</div>
                    <div className="text-xs opacity-75">Movimento veloce</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('cinematic')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'cinematic'
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Cinematico</div>
                    <div className="text-xs opacity-75">Stile film professionale</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('explosion')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'explosion'
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Esplosione</div>
                    <div className="text-xs opacity-75">Assemblaggio pezzi</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('orbital')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'orbital'
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Orbitale 360°</div>
                    <div className="text-xs opacity-75">Camera vola intorno</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('reassembly')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'reassembly'
                        ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Ricostruzione</div>
                    <div className="text-xs opacity-75">Da frammenti a prodotto</div>
                  </button>
                </div>

                {/* Durata Video - Slider */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-purple-300">
                      Durata Video
                    </label>
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {videoDuration}s
                    </span>
                  </div>

                  <div className="relative pt-1">
                    <input
                      type="range"
                      min="4"
                      max="8"
                      step="2"
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(parseInt(e.target.value) as VideoDuration)}
                      disabled={isGenerating}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-6
                        [&::-webkit-slider-thumb]:h-6
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-gradient-to-r
                        [&::-webkit-slider-thumb]:from-purple-500
                        [&::-webkit-slider-thumb]:to-pink-500
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:transition-transform
                        [&::-webkit-slider-thumb]:hover:scale-110
                        [&::-moz-range-thumb]:w-6
                        [&::-moz-range-thumb]:h-6
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-gradient-to-r
                        [&::-moz-range-thumb]:from-purple-500
                        [&::-moz-range-thumb]:to-pink-500
                        [&::-moz-range-thumb]:border-0
                        [&::-moz-range-thumb]:shadow-lg
                        [&::-moz-range-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between mt-2 text-xs text-purple-300/70">
                      <span>⚡ 4s</span>
                      <span>⏱️ 6s</span>
                      <span>🎬 8s (max)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tone & Target */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-2">
                Tone of Voice
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['professional', 'casual', 'fun', 'luxury'] as Tone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    disabled={isGenerating}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      tone === t
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50'
                    } disabled:opacity-50 capitalize`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium text-purple-300 mb-2">
                Target Audience (opzionale)
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Es: Giovani professionisti 25-35 anni"
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 text-sm"
                disabled={isGenerating}
              />
            </div>

            {/* Ricetta Tradizionale */}
            <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 backdrop-blur-sm rounded-xl border border-amber-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👨‍🍳</span>
                  <h3 className="text-lg font-semibold text-amber-300">Ricetta Tradizionale</h3>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRecipe}
                    onChange={(e) => setIncludeRecipe(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded border-amber-500/50 bg-slate-900/50 text-amber-500 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-amber-300">Crea ricetta</span>
                </label>
              </div>
              <p className="text-xs text-amber-300/70 mb-3">
                💡 L'AI cercherà automaticamente ricette tradizionali autentiche del prodotto e genererà un'immagine food photography
              </p>

              {/* Campo suggerimento ricetta - visibile solo se includeRecipe è attivo */}
              {includeRecipe && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-amber-300 mb-2">
                    Suggerisci una ricetta (opzionale)
                  </label>
                  <input
                    type="text"
                    value={recipeSuggestion}
                    onChange={(e) => setRecipeSuggestion(e.target.value)}
                    placeholder="Es: Carbonara, Amatriciana, Cacio e pepe..."
                    className="w-full px-4 py-2 bg-slate-900/50 border border-amber-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder:text-slate-500 text-sm"
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-amber-300/50 mt-1">
                    Se lasci vuoto, l'AI sceglierà la ricetta più adatta al prodotto
                  </p>
                </div>
              )}
            </div>

            {/* Storia del Prodotto */}
            <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 backdrop-blur-sm rounded-xl border border-emerald-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-emerald-300">Storia del Prodotto</h3>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeProductStory}
                    onChange={(e) => setIncludeProductStory(e.target.checked)}
                    disabled={isGenerating || isGeneratingStory}
                    className="w-4 h-4 rounded border-emerald-500/50 bg-slate-900/50 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-emerald-300">Genera storia</span>
                </label>
              </div>
              <p className="text-xs text-emerald-300/70 mb-3">
                📚 Ricerca origine, tradizione, certificazioni DOP/IGP e curiosità storiche del prodotto → Blog + Social
              </p>

              {includeProductStory && (
                <div className="mt-3">
                  <button
                    onClick={handleGenerateStory}
                    disabled={isGeneratingStory || !productName}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingStory ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Ricerca in corso...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-5 w-5" />
                        <span>Cerca Storia Prodotto</span>
                      </>
                    )}
                  </button>
                  {!productName && (
                    <p className="text-xs text-red-400 mt-2">
                      ⚠️ Inserisci prima il nome del prodotto
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Curiosità Food */}
            <div className="bg-gradient-to-br from-rose-900/20 to-pink-900/20 backdrop-blur-sm rounded-xl border border-rose-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-6 w-6 text-rose-400" />
                  <h3 className="text-lg font-semibold text-rose-300">Curiosità Food</h3>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFoodCuriosity}
                    onChange={(e) => setIncludeFoodCuriosity(e.target.checked)}
                    disabled={isGenerating || isSearchingCuriosities}
                    className="w-4 h-4 rounded border-rose-500/50 bg-slate-900/50 text-rose-500 focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="text-xs text-rose-300">Cerca curiosità</span>
                </label>
              </div>
              <p className="text-xs text-rose-300/70 mb-3">
                💡 Cerca news, trend e curiosità dal mondo del food mediterraneo → Scegli e pubblica sui Social
              </p>

              {includeFoodCuriosity && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-rose-300 mb-2">
                      Argomento (opzionale)
                    </label>
                    <input
                      type="text"
                      value={curiosityTopic}
                      onChange={(e) => setCuriosityTopic(e.target.value)}
                      placeholder="Es: olio d'oliva, vino italiano, formaggi..."
                      className="w-full px-4 py-2 bg-slate-900/50 border border-rose-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-white placeholder:text-slate-500 text-sm"
                      disabled={isSearchingCuriosities}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-rose-300 mb-2">
                      Categoria
                    </label>
                    <select
                      value={curiosityCategory}
                      onChange={(e) => setCuriosityCategory(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-rose-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-white text-sm"
                      disabled={isSearchingCuriosities}
                    >
                      <option value="">Tutte le categorie</option>
                      <option value="news">📰 News recenti</option>
                      <option value="tradizione">🏛️ Tradizione e storia</option>
                      <option value="innovazione">🚀 Innovazione e futuro</option>
                      <option value="sostenibilità">🌿 Sostenibilità</option>
                      <option value="salute">❤️ Salute e benefici</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSearchCuriosities}
                    disabled={isSearchingCuriosities}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearchingCuriosities ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Ricerca in corso...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-5 w-5" />
                        <span>Cerca Curiosità</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Idea Libera → Articolo AI */}
            <div className="bg-gradient-to-br from-violet-900/20 to-indigo-900/20 backdrop-blur-sm rounded-xl border border-violet-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PenTool className="h-6 w-6 text-violet-400" />
                  <h3 className="text-lg font-semibold text-violet-300">Idea Libera → Articolo AI</h3>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFreeArticle}
                    onChange={(e) => setIncludeFreeArticle(e.target.checked)}
                    disabled={isGenerating || isGeneratingArticle}
                    className="w-4 h-4 rounded border-violet-500/50 bg-slate-900/50 text-violet-500 focus:ring-2 focus:ring-violet-500"
                  />
                  <span className="text-xs text-violet-300">Genera articolo</span>
                </label>
              </div>
              <p className="text-xs text-violet-300/70 mb-3">
                💡 Trasforma una tua idea in un articolo completo professionale (blog + social), modificabile passo-passo con l'AI
              </p>

              {includeFreeArticle && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-violet-300 mb-2">
                      Scrivi la tua idea
                    </label>
                    <textarea
                      value={freeArticleIdea}
                      onChange={(e) => setFreeArticleIdea(e.target.value)}
                      placeholder="Es: I segreti della mozzarella di bufala campana, come riconoscere quella autentica e abbinarla al meglio..."
                      rows={3}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-violet-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-white placeholder:text-slate-500 text-sm resize-none"
                      disabled={isGeneratingArticle}
                    />
                    <p className="text-xs text-violet-300/50 mt-1">
                      Descrivi il concetto, l'argomento o l'idea che vuoi sviluppare in un articolo completo
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-violet-300 mb-2">
                      Obiettivo Articolo
                    </label>
                    <select
                      value={articleObjective}
                      onChange={(e) => setArticleObjective(e.target.value as any)}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-violet-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-white text-sm"
                      disabled={isGeneratingArticle}
                    >
                      <option value="blog_seo">📊 Blog SEO - Ottimizzato per motori di ricerca</option>
                      <option value="inspirational">✨ Ispirazionale - Emozionale e coinvolgente</option>
                      <option value="b2b">💼 B2B Commerciale - Per professionisti HoReCa</option>
                      <option value="storytelling">📖 Storytelling - Narrativo e avvincente</option>
                    </select>
                  </div>

                  <button
                    onClick={handleGenerateArticle}
                    disabled={isGeneratingArticle || !freeArticleIdea.trim() || freeArticleIdea.length < 10}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingArticle ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Generazione in corso...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5" />
                        <span>Genera Articolo</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Geo-Targeting & RAG */}
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 backdrop-blur-sm rounded-xl border border-cyan-500/30 p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🇨🇭</span>
                <h3 className="text-lg font-semibold text-cyan-300">Geo-Targeting & Smart RAG</h3>
              </div>
              <p className="text-xs text-cyan-300/70 mb-4">
                💡 L'AI imparerà dai post simili performanti nel Canton selezionato
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">
                    Canton Svizzero
                  </label>
                  <select
                    value={targetCanton}
                    onChange={(e) => setTargetCanton(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-cyan-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                    disabled={isGenerating}
                  >
                    <option value="">Nessuno</option>
                    <option value="Zürich">🏙️ Zürich</option>
                    <option value="Bern">🏛️ Bern</option>
                    <option value="Ticino">🏔️ Ticino</option>
                    <option value="Vaud">🍷 Vaud</option>
                    <option value="Genève">🌍 Genève</option>
                    <option value="Basel-Stadt">🎨 Basel</option>
                    <option value="Luzern">🌊 Luzern</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">
                    Città (opzionale)
                  </label>
                  <input
                    type="text"
                    value={targetCity}
                    onChange={(e) => setTargetCity(e.target.value)}
                    placeholder={targetCanton === 'Zürich' ? 'Es: Zürich' : targetCanton === 'Ticino' ? 'Es: Lugano' : 'Es: Bern'}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-cyan-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder:text-slate-500 text-sm"
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2">
                  Categoria Prodotto (per RAG)
                </label>
                <select
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-cyan-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                  disabled={isGenerating}
                >
                  <option value="">Auto-detect</option>
                  <option value="Food">🍽️ Food & Alimenti</option>
                  <option value="Gastro">🍴 Gastro & Ristorazione</option>
                  <option value="Beverage">🍷 Beverage & Vini</option>
                  <option value="Dairy">🧀 Latticini & Formaggi</option>
                  <option value="Fresh">🥬 Prodotti Freschi</option>
                  <option value="Frozen">❄️ Surgelati</option>
                </select>
              </div>

              {(targetCanton || productCategory) && (
                <div className="mt-3 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
                  <p className="text-xs text-cyan-300/90">
                    ✨ <strong>RAG Attivo:</strong> L'AI cercherà post simili performanti
                    {targetCanton && ` nel Canton ${targetCanton}`}
                    {productCategory && ` nella categoria ${productCategory}`}
                    {' '}per ottimizzare hashtags e CTA.
                  </p>
                </div>
              )}
            </div>

            {/* Pulsante Genera */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !productImage}
              className="w-full flex items-center justify-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-purple-500/25 text-sm sm:text-base md:text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                  <span>Generazione in corso...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-center">Genera Contenuti Marketing AI 🚀</span>
                </>
              )}
            </button>

            {/* Progress */}
            {generationProgress.length > 0 && (
              <div className="bg-slate-900/50 border border-purple-500/30 rounded-xl p-4">
                <div className="text-xs text-purple-300 space-y-1">
                  {generationProgress.map((msg, idx) => (
                    <div key={idx}>{msg}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========================================== */}
          {/* COLONNA DESTRA: Risultati */}
          {/* ========================================== */}
          <div className="space-y-4 sm:space-y-6">

            {/* Info Card */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4 sm:p-6">
              <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span>Come funziona</span>
              </h3>
              <ul className="space-y-2 text-sm text-purple-200">
                <li className="flex items-start space-x-2">
                  <span className="text-purple-400">1.</span>
                  <span>Carica una foto del tuo prodotto o processo</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-pink-400">2.</span>
                  <span>Scegli piattaforma social e tipo contenuto (foto/video)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-orange-400">3.</span>
                  <span>3 Agenti AI lavorano in PARALLELO per te!</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400">4.</span>
                  <span>Ricevi: Caption + Hashtags + Immagine/Video pronti!</span>
                </li>
              </ul>
            </div>

            {/* Risultati */}
            {result && (
              <>
                {/* Pulsante Condividi (grande, sopra i risultati) */}
                <button
                  onClick={() => setIsShareMenuOpen(true)}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25"
                >
                  <Share2 className="h-5 w-5" />
                  <span>Condividi sui Social 🚀</span>
                </button>

                {/* Copywriting */}
                <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <MessageSquare className="h-5 w-5 text-purple-400" />
                    <h3 className="text-white font-semibold">Copywriting</h3>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-purple-300 mb-1">Caption</div>
                      <div className="text-white bg-slate-900/50 p-3 rounded-lg">
                        {result.copywriting.caption}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-purple-300 mb-1 flex items-center space-x-1">
                        <Hash className="h-3 w-3" />
                        <span>Hashtags</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.copywriting.hashtags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-purple-300 mb-1 flex items-center space-x-1">
                        <Target className="h-3 w-3" />
                        <span>Call-to-Action</span>
                      </div>
                      <div className="text-white bg-slate-900/50 p-3 rounded-lg">
                        {result.copywriting.cta}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sentiment Analysis */}
                {result.sentiment && (
                  <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-4 sm:p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-blue-400" />
                      <h3 className="text-white font-semibold">AI Sentiment Analysis</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                    </div>

                    {/* Sentiment & Engagement */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Sentiment Badge */}
                      <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/30">
                        <div className="text-xs text-blue-300 mb-1">Sentiment</div>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{getSentimentEmoji(result.sentiment.sentiment)}</span>
                          <div>
                            <div className="text-white font-semibold capitalize">{result.sentiment.sentiment}</div>
                            <div className="text-xs text-blue-400">Score: {result.sentiment.sentimentScore.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Predicted Engagement */}
                      <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/30">
                        <div className="text-xs text-blue-300 mb-1">Predicted Engagement</div>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{getEngagementLevel(result.sentiment.predictedEngagement).emoji}</span>
                          <div>
                            <div className={`font-bold text-lg ${getEngagementLevel(result.sentiment.predictedEngagement).color}`}>
                              {result.sentiment.predictedEngagement.toFixed(1)}%
                            </div>
                            <div className="text-xs text-blue-400">
                              {getEngagementLevel(result.sentiment.predictedEngagement).label}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quality Score */}
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/30 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-blue-300 flex items-center space-x-1">
                          <Award className="h-3 w-3" />
                          <span>Quality Score</span>
                        </div>
                        <div className="text-white font-bold text-lg">{result.sentiment.qualityScore}/100</div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            result.sentiment.qualityScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                            result.sentiment.qualityScore >= 60 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                            result.sentiment.qualityScore >= 40 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                            'bg-gradient-to-r from-red-500 to-pink-500'
                          }`}
                          style={{ width: `${result.sentiment.qualityScore}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Recommendation Badge */}
                    <div className={`rounded-lg p-3 mb-4 border ${
                      result.sentiment.recommendation === 'ready_to_post' ? 'bg-green-900/20 border-green-500/30' :
                      result.sentiment.recommendation === 'needs_improvement' ? 'bg-yellow-900/20 border-yellow-500/30' :
                      'bg-red-900/20 border-red-500/30'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {result.sentiment.recommendation === 'ready_to_post' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : result.sentiment.recommendation === 'needs_improvement' ? (
                          <AlertCircle className="h-5 w-5 text-yellow-400" />
                        ) : (
                          <X className="h-5 w-5 text-red-400" />
                        )}
                        <div>
                          <div className={`font-semibold ${getRecommendationColor(result.sentiment.recommendation)}`}>
                            {result.sentiment.recommendation === 'ready_to_post' ? '✅ Ready to Post!' :
                             result.sentiment.recommendation === 'needs_improvement' ? '⚠️ Needs Improvement' :
                             '❌ Regenerate Content'}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {result.sentiment.recommendation === 'ready_to_post' ? 'Excellent quality - share immediately' :
                             result.sentiment.recommendation === 'needs_improvement' ? 'Good but can be optimized' :
                             'Consider regenerating with different parameters'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Strengths */}
                    {result.sentiment.strengths.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-green-300 mb-2 flex items-center space-x-1 font-medium">
                          <Zap className="h-3 w-3" />
                          <span>Strengths</span>
                        </div>
                        <div className="space-y-1.5">
                          {result.sentiment.strengths.map((strength, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <span className="text-green-200">{strength}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Improvements */}
                    {result.sentiment.improvements.length > 0 && (
                      <div>
                        <div className="text-xs text-yellow-300 mb-2 flex items-center space-x-1 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          <span>Suggested Improvements</span>
                        </div>
                        <div className="space-y-1.5">
                          {result.sentiment.improvements.map((improvement, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-yellow-400 mt-0.5">→</span>
                              <span className="text-yellow-200">{improvement}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ricetta Tradizionale */}
                {recipeData && (
                  <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 backdrop-blur-sm rounded-xl border border-amber-500/30 p-4 sm:p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="text-2xl">👨‍🍳</div>
                      <h3 className="text-white font-semibold">Ricetta Tradizionale</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                    </div>

                    {/* Immagine ricetta */}
                    {recipeData.imageUrl && (
                      <img
                        src={recipeData.imageUrl}
                        alt="Ricetta"
                        className="w-full h-auto rounded-lg border border-amber-500/50 mb-4"
                      />
                    )}

                    {/* Titolo e Descrizione */}
                    <div className="mb-4">
                      <h4 className="text-xl font-bold text-amber-200 mb-2">
                        {recipeData.recipe.title}
                      </h4>
                      <p className="text-sm text-amber-300/90 mb-3">
                        {recipeData.recipe.description}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          📍 {recipeData.recipe.region}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          ⏱️ Prep: {recipeData.recipe.prepTime}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          🔥 Cook: {recipeData.recipe.cookTime}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          🍽️ {recipeData.recipe.servings}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          📊 {recipeData.recipe.difficulty}
                        </span>
                      </div>
                    </div>

                    {/* Tradizione */}
                    <div className="mb-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-amber-300/90">
                        <strong>Tradizione:</strong> {recipeData.recipe.tradition}
                      </p>
                    </div>

                    {/* Ingredienti */}
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-amber-200 mb-2">Ingredienti</div>
                      <div className="space-y-1.5">
                        {recipeData.recipe.ingredients.map((ing: any, idx: number) => (
                          <div key={idx} className="flex items-start space-x-2 text-sm">
                            <span className="text-amber-400">•</span>
                            <span className="text-amber-200">
                              <strong>{ing.quantity}</strong> {ing.item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Procedimento */}
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-amber-200 mb-2">Procedimento</div>
                      <div className="space-y-2">
                        {recipeData.recipe.steps.map((step: string, idx: number) => (
                          <div key={idx} className="flex items-start space-x-2 text-sm">
                            <span className="text-amber-400 font-bold min-w-[20px]">{idx + 1}.</span>
                            <span className="text-amber-200">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tips */}
                    {recipeData.recipe.tips && recipeData.recipe.tips.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-amber-200 mb-2">💡 Consigli</div>
                        <div className="space-y-1.5">
                          {recipeData.recipe.tips.map((tip: string, idx: number) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-amber-400">→</span>
                              <span className="text-amber-200">{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fonti */}
                    {recipeData.sources && recipeData.sources.length > 0 && (
                      <details className="mb-4">
                        <summary className="text-xs text-amber-400 cursor-pointer hover:text-amber-300">
                          Fonti utilizzate
                        </summary>
                        <div className="mt-2 space-y-1">
                          {recipeData.sources.map((source: any, idx: number) => (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-amber-500 hover:text-amber-400 truncate"
                            >
                              → {source.title}
                            </a>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Pulsanti Download e Pubblica */}
                    <div className="space-y-3">
                      {recipeData.imageUrl && (
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = recipeData.imageUrl;
                            link.download = `ricetta-${productName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
                            link.click();
                          }}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Immagine Ricetta</span>
                        </button>
                      )}

                      {/* Pulsanti Pubblica e Programma */}
                      <div className="flex gap-2">
                        <button
                          onClick={handlePublishRecipe}
                          disabled={isPublishingRecipe || !recipeData.imageUrl}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                          {isPublishingRecipe ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Pubblicazione...</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-5 w-5" />
                              <span>Pubblica Subito</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => openScheduleModal('recipe')}
                          disabled={!recipeData.imageUrl}
                          className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          title="Programma pubblicazione"
                        >
                          <Calendar className="h-5 w-5" />
                          <span>Programma</span>
                        </button>
                      </div>

                      {/* Progress Pubblicazione */}
                      {publishProgress.length > 0 && (
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-amber-500/30">
                          <div className="space-y-1">
                            {publishProgress.map((msg, idx) => (
                              <div key={idx} className="text-xs text-amber-200">
                                {msg}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Immagine */}
                {result.image && (
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <ImageIcon className="h-5 w-5 text-purple-400" />
                      <h3 className="text-white font-semibold">Immagine Marketing</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                    </div>

                    <img
                      src={result.image.dataUrl}
                      alt="Marketing"
                      className="w-full h-auto rounded-lg border border-purple-500/50 mb-3"
                    />

                    <button
                      onClick={handleDownloadImage}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Immagine</span>
                    </button>

                    <div className="mt-2 text-xs text-purple-300 text-center">
                      Generato con Nano Banana 🍌 (Gemini 2.5 Flash Image)
                    </div>
                  </div>
                )}

                {/* Video */}
                {result.video && (
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <Video className="h-5 w-5 text-purple-400" />
                      <h3 className="text-white font-semibold">Video Marketing</h3>
                      {result.video.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                      )}
                      {result.video.status === 'generating' && (
                        <Loader2 className="h-4 w-4 text-yellow-400 ml-auto animate-spin" />
                      )}
                    </div>

                    {result.video.status === 'generating' && (
                      <div className="text-center py-8 space-y-4">
                        <Loader2 className="h-12 w-12 text-purple-500 mx-auto animate-spin" />
                        <div className="text-purple-300">
                          Veo 3.1 sta generando il video...
                        </div>
                        <div className="text-xs text-purple-400">
                          Questo può richiedere 1-3 minuti
                        </div>
                      </div>
                    )}

                    {result.video.status === 'completed' && result.video.dataUrl && (
                      <>
                        <video
                          src={result.video.dataUrl}
                          controls
                          className="w-full h-auto rounded-lg border border-purple-500/50 mb-3"
                        />

                        <div className="space-y-2">
                          <button
                            onClick={handleDownloadVideo}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Video</span>
                          </button>

                          <button
                            onClick={handlePublishYouTube}
                            disabled={isPublishingYouTube}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isPublishingYouTube ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Pubblicazione in corso...</span>
                              </>
                            ) : (
                              <>
                                <Youtube className="h-4 w-4" />
                                <span>Pubblica su YouTube</span>
                              </>
                            )}
                          </button>

                          {youtubePublishResult && (
                            <div className="mt-3 p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-lg">
                              <div className="flex items-start space-x-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-emerald-300 font-medium">
                                    Pubblicato su YouTube!
                                  </div>
                                  <div className="text-purple-300 text-xs mt-1">
                                    {youtubePublishResult.youtubeTitle}
                                  </div>
                                  {youtubePublishResult.videoUrl && (
                                    <a
                                      href={youtubePublishResult.videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-400 hover:text-blue-300 underline mt-1 inline-block"
                                    >
                                      Vedi su YouTube →
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-purple-300 text-center">
                          Generato con Veo 3.1 (Google AI)
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Placeholder quando non ci sono risultati */}
            {!result && !isGenerating && !storyData && curiositiesList.length === 0 && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-12 text-center">
                <Sparkles className="h-16 w-16 text-purple-500/30 mx-auto mb-4" />
                <div className="text-purple-400 font-medium">
                  I contenuti marketing appariranno qui
                </div>
                <div className="text-purple-500/50 text-sm mt-2">
                  Carica una foto e clicca "Genera"
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* SEZIONI INDIPENDENTI (fuori da result) */}
            {/* ========================================== */}

            {/* Storia del Prodotto - Mostrata indipendentemente */}
            {storyData && (
              <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 backdrop-blur-sm rounded-xl border border-emerald-500/30 p-4 sm:p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <BookOpen className="h-6 w-6 text-emerald-400" />
                  <h3 className="text-white font-semibold">Storia del Prodotto</h3>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                </div>

                {/* Immagine storia */}
                {storyData.imageUrl && (
                  <img
                    src={storyData.imageUrl}
                    alt="Storia prodotto"
                    className="w-full h-auto rounded-lg border border-emerald-500/50 mb-4"
                  />
                )}

                {/* Titolo e Introduzione */}
                <div className="mb-4">
                  <h4 className="text-xl font-bold text-emerald-200 mb-2">
                    {storyData.story.title}
                  </h4>
                  <p className="text-sm text-emerald-300/90 italic mb-3">
                    {storyData.story.subtitle}
                  </p>
                  <p className="text-sm text-emerald-300/90">
                    {storyData.story.introduction}
                  </p>
                </div>

                {/* Origine */}
                <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                  <div className="text-sm font-semibold text-emerald-200 mb-2">📍 Origine</div>
                  <p className="text-xs text-emerald-300/90 mb-1">
                    <strong>Regione:</strong> {storyData.story.origin?.region}
                  </p>
                  <p className="text-xs text-emerald-300/90">
                    {storyData.story.origin?.history}
                  </p>
                  {storyData.story.origin?.year && (
                    <p className="text-xs text-emerald-400 mt-1">
                      📅 {storyData.story.origin.year}
                    </p>
                  )}
                </div>

                {/* Tradizione */}
                <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                  <div className="text-sm font-semibold text-emerald-200 mb-2">🏛️ Tradizione</div>
                  <p className="text-xs text-emerald-300/90 mb-2">
                    {storyData.story.tradition?.description}
                  </p>
                  <p className="text-xs text-emerald-300/90">
                    <strong>Significato culturale:</strong> {storyData.story.tradition?.culturalSignificance}
                  </p>
                </div>

                {/* Certificazione */}
                {storyData.story.certification && storyData.story.certification.type !== 'Nessuna' && (
                  <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <div className="text-sm font-semibold text-yellow-200 mb-2">
                      🏅 Certificazione {storyData.story.certification.type}
                    </div>
                    <p className="text-xs text-yellow-300/90">
                      {storyData.story.certification.description}
                    </p>
                  </div>
                )}

                {/* Curiosità */}
                {storyData.story.curiosities && storyData.story.curiosities.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-emerald-200 mb-2">💡 Curiosità</div>
                    <div className="space-y-1.5">
                      {storyData.story.curiosities.map((curiosity: string, idx: number) => (
                        <div key={idx} className="flex items-start space-x-2 text-sm">
                          <span className="text-emerald-400">•</span>
                          <span className="text-emerald-200">{curiosity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Abbinamenti */}
                {storyData.story.pairings && storyData.story.pairings.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-emerald-200 mb-2">🍷 Abbinamenti</div>
                    <div className="flex flex-wrap gap-2">
                      {storyData.story.pairings.map((pairing: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-emerald-900/40 border border-emerald-500/30 rounded-full text-xs text-emerald-300">
                          {pairing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quote */}
                {storyData.story.quote && (
                  <div className="mb-4 p-3 bg-emerald-900/30 border-l-4 border-emerald-500 rounded-r-lg italic">
                    <p className="text-sm text-emerald-200">
                      "{storyData.story.quote}"
                    </p>
                  </div>
                )}

                {/* Pulsanti */}
                <div className="space-y-3">
                  {storyData.imageUrl && (
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = storyData.imageUrl;
                        link.download = `storia-${productName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
                        link.click();
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Immagine Storia</span>
                    </button>
                  )}

                  {/* Pulsanti Pubblica e Programma */}
                  <div className="flex gap-2">
                    <button
                      onClick={handlePublishStory}
                      disabled={isPublishingStory}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isPublishingStory ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Pubblicazione...</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-5 w-5" />
                          <span>Pubblica Subito</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => openScheduleModal('story')}
                      disabled={!storyData?.imageUrl}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      title="Programma pubblicazione"
                    >
                      <Calendar className="h-5 w-5" />
                      <span>Programma</span>
                    </button>
                  </div>

                  {storyPublishProgress.length > 0 && (
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-emerald-500/30">
                      <div className="space-y-1">
                        {storyPublishProgress.map((msg, idx) => (
                          <div key={idx} className="text-xs text-emerald-200">
                            {msg}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Curiosità Food - Lista risultati - Mostrata indipendentemente */}
            {curiositiesList.length > 0 && (
              <div className="bg-gradient-to-br from-rose-900/20 to-pink-900/20 backdrop-blur-sm rounded-xl border border-rose-500/30 p-4 sm:p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Lightbulb className="h-6 w-6 text-rose-400" />
                  <h3 className="text-white font-semibold">Curiosità Food Trovate</h3>
                  <span className="ml-auto text-xs text-rose-300 bg-rose-900/40 px-2 py-1 rounded-full">
                    {curiositiesList.length} risultati
                  </span>
                </div>

                <p className="text-xs text-rose-300/70 mb-4">
                  Seleziona una curiosità da pubblicare sui social:
                </p>

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {curiositiesList.map((curiosity, idx) => (
                    <div
                      key={curiosity.id || idx}
                      onClick={() => {
                        setSelectedCuriosity(curiosity);
                        setCuriosityPreviewImage(null); // Reset immagine quando cambi curiosità
                        setTranslatedCuriosity(null); // Reset traduzione quando cambi curiosità
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedCuriosity?.id === curiosity.id
                          ? 'bg-rose-500/30 border-2 border-rose-400'
                          : 'bg-slate-900/50 border border-rose-500/30 hover:border-rose-400'
                      }`}
                    >
                      <h4 className="text-sm font-semibold text-rose-200 mb-1">
                        {curiosity.title}
                      </h4>
                      <p className="text-xs text-rose-300/80 mb-2">
                        {curiosity.summary}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {curiosity.tags?.slice(0, 3).map((tag: string, tagIdx: number) => (
                          <span key={tagIdx} className="px-1.5 py-0.5 bg-rose-900/40 text-rose-300 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {curiosity.source && (
                        <p className="text-xs text-rose-400 mt-2">
                          📚 {curiosity.source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Dettagli curiosità selezionata */}
                {selectedCuriosity && (
                  <div className="mt-4 p-4 bg-rose-900/30 border border-rose-500/50 rounded-lg">
                    <h4 className="text-sm font-bold text-rose-200 mb-2">
                      ✨ {selectedCuriosity.title}
                    </h4>
                    <p className="text-sm text-rose-300/90 mb-3">
                      {selectedCuriosity.fullContent}
                    </p>

                    <div className="mb-3">
                      <div className="text-xs text-rose-300 mb-1">Caption Social:</div>
                      <p className="text-xs text-white bg-slate-900/50 p-2 rounded">
                        {selectedCuriosity.socialCaption}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {selectedCuriosity.hashtags?.map((tag: string, idx: number) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-rose-900/40 text-rose-300 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Sezione Traduzione */}
                    <div className="mb-4 p-3 bg-slate-900/50 border border-rose-500/30 rounded-lg">
                      <div className="text-xs text-rose-300 mb-2 flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Lingua di pubblicazione:
                      </div>
                      <div className="flex gap-2 mb-3">
                        {[
                          { code: 'it', label: '🇮🇹 IT', name: 'Italiano' },
                          { code: 'de', label: '🇨🇭 DE', name: 'Tedesco' },
                          { code: 'fr', label: '🇨🇭 FR', name: 'Francese' },
                          { code: 'en', label: '🇬🇧 EN', name: 'Inglese' }
                        ].map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              setPublishLanguage(lang.code as 'it' | 'de' | 'fr' | 'en');
                              setTranslatedCuriosity(null); // Reset traduzione quando cambi lingua
                            }}
                            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                              publishLanguage === lang.code
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-800 text-rose-300 hover:bg-slate-700'
                            }`}
                            title={lang.name}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>

                      {/* Pulsante Traduci */}
                      {publishLanguage !== 'it' && !translatedCuriosity && (
                        <button
                          onClick={handleTranslateCuriosity}
                          disabled={isTranslatingCuriosity}
                          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          {isTranslatingCuriosity ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Traduzione in corso...</span>
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              <span>Traduci in {publishLanguage === 'de' ? 'Tedesco' : publishLanguage === 'fr' ? 'Francese' : 'Inglese'}</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Anteprima Contenuto Tradotto */}
                      {translatedCuriosity && (
                        <div className="mt-3 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                          <div className="text-xs text-blue-300 mb-2 font-semibold">
                            ✅ Contenuto tradotto in {publishLanguage === 'de' ? 'Tedesco' : publishLanguage === 'fr' ? 'Francese' : 'Inglese'}:
                          </div>
                          <h5 className="text-sm font-bold text-blue-200 mb-2">
                            {translatedCuriosity.title}
                          </h5>
                          <p className="text-xs text-blue-300/90 mb-2">
                            {translatedCuriosity.fullContent}
                          </p>
                          <div className="text-xs text-blue-300 mb-1">Caption:</div>
                          <p className="text-xs text-white bg-slate-900/50 p-2 rounded mb-2">
                            {translatedCuriosity.socialCaption}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {translatedCuriosity.hashtags?.map((tag: string, idx: number) => (
                              <span key={idx} className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => setTranslatedCuriosity(null)}
                            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                          >
                            ✖ Rimuovi traduzione
                          </button>
                        </div>
                      )}

                      {/* Info se italiano selezionato */}
                      {publishLanguage === 'it' && (
                        <div className="text-xs text-rose-400/70 italic">
                          Pubblicazione in italiano (contenuto originale)
                        </div>
                      )}
                    </div>

                    {/* Anteprima Immagine */}
                    {curiosityPreviewImage && (
                      <div className="mb-4">
                        <div className="text-xs text-rose-300 mb-2">Anteprima Immagine:</div>
                        <img
                          src={curiosityPreviewImage}
                          alt="Anteprima curiosità"
                          className="w-full h-auto rounded-lg border border-rose-500/50"
                        />
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = curiosityPreviewImage;
                            link.download = `curiosity-${selectedCuriosity.id}-${Date.now()}.png`;
                            link.click();
                          }}
                          className="mt-2 w-full flex items-center justify-center space-x-2 px-3 py-2 bg-rose-500/30 hover:bg-rose-500/40 text-rose-200 text-sm rounded-lg transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Immagine</span>
                        </button>
                      </div>
                    )}

                    {/* Pulsante Genera Anteprima */}
                    {!curiosityPreviewImage && (
                      <button
                        onClick={handleGenerateCuriosityPreview}
                        disabled={isGeneratingCuriosityImage}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-3"
                      >
                        {isGeneratingCuriosityImage ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Generazione immagine AI...</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-5 w-5" />
                            <span>Genera Anteprima Immagine</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Pulsanti Pubblica e Programma (solo se immagine già generata) */}
                    <div className="flex gap-2">
                      <button
                        onClick={handlePublishCuriosity}
                        disabled={isPublishingCuriosity || !curiosityPreviewImage}
                        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                          curiosityPreviewImage
                            ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700'
                            : 'bg-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {isPublishingCuriosity ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Pubblicazione...</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="h-5 w-5" />
                            <span>{curiosityPreviewImage ? 'Pubblica Subito' : 'Prima genera anteprima'}</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => openScheduleModal('curiosity')}
                        disabled={!curiosityPreviewImage}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                          curiosityPreviewImage
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
                            : 'bg-gray-600 cursor-not-allowed'
                        }`}
                        title="Programma pubblicazione"
                      >
                        <Calendar className="h-5 w-5" />
                        <span>Programma</span>
                      </button>
                    </div>

                    {curiosityPublishProgress.length > 0 && (
                      <div className="mt-3 bg-slate-900/50 rounded-lg p-3 border border-rose-500/30">
                        <div className="space-y-1">
                          {curiosityPublishProgress.map((msg, idx) => (
                            <div key={idx} className="text-xs text-rose-200">
                              {msg}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Articolo AI - Mostrato indipendentemente */}
            {articleData && (
              <div className="bg-gradient-to-br from-violet-900/20 to-indigo-900/20 backdrop-blur-sm rounded-xl border border-violet-500/30 p-4 sm:p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <FileText className="h-6 w-6 text-violet-400" />
                  <h3 className="text-white font-semibold">Articolo Generato</h3>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                </div>

                {/* Immagine di copertina con pulsante rigenera */}
                {articleData.imageUrl && (
                  <div className="mb-4">
                    <img
                      src={articleData.imageUrl}
                      alt="Copertina articolo"
                      className="w-full h-auto rounded-lg border border-violet-500/50"
                    />
                    <button
                      onClick={handleRegenerateArticleImage}
                      disabled={isRegeneratingImage}
                      className="mt-2 flex items-center justify-center space-x-2 w-full px-3 py-2 bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isRegeneratingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Rigenerando immagine...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          <span>Rigenera Immagine</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Titolo (editabile) */}
                <div className="mb-4">
                  <label className="text-xs text-violet-400 mb-1 block">Titolo</label>
                  <input
                    type="text"
                    value={articleData.article.title}
                    onChange={(e) => updateArticleField('title', e.target.value)}
                    className="w-full bg-slate-800/50 border border-violet-500/30 rounded-lg px-3 py-2 text-lg font-bold text-violet-200 focus:outline-none focus:border-violet-400"
                  />
                </div>

                {/* Sottotitolo (editabile) */}
                <div className="mb-4">
                  <label className="text-xs text-violet-400 mb-1 block">Sottotitolo</label>
                  <input
                    type="text"
                    value={articleData.article.subtitle}
                    onChange={(e) => updateArticleField('subtitle', e.target.value)}
                    className="w-full bg-slate-800/50 border border-violet-500/30 rounded-lg px-3 py-2 text-sm italic text-violet-300 focus:outline-none focus:border-violet-400"
                  />
                </div>

                {/* Introduzione (editabile) */}
                <div className="mb-4 p-3 bg-violet-900/20 border border-violet-500/30 rounded-lg">
                  <label className="text-sm font-semibold text-violet-200 mb-2 block">Introduzione</label>
                  <textarea
                    value={articleData.article.introduction}
                    onChange={(e) => updateArticleField('introduction', e.target.value)}
                    rows={4}
                    className="w-full bg-slate-800/50 border border-violet-500/20 rounded-lg px-3 py-2 text-sm text-violet-200/90 focus:outline-none focus:border-violet-400 resize-none"
                  />
                </div>

                {/* Sezioni (editabili) */}
                <div className="mb-4 space-y-3">
                  <div className="text-sm font-semibold text-violet-200">Sezioni dell'articolo</div>
                  {articleData.article.sections.map((section: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-900/50 border border-violet-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-violet-400 text-sm font-medium">{idx + 1}.</span>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateArticleSection(idx, 'title', e.target.value)}
                          className="flex-1 bg-slate-800/50 border border-violet-500/20 rounded px-2 py-1 text-sm font-semibold text-violet-300 focus:outline-none focus:border-violet-400"
                        />
                      </div>
                      <textarea
                        value={section.content}
                        onChange={(e) => updateArticleSection(idx, 'content', e.target.value)}
                        rows={4}
                        className="w-full bg-slate-800/30 border border-violet-500/10 rounded px-2 py-1 text-xs text-violet-200/80 focus:outline-none focus:border-violet-400 resize-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Conclusione (editabile) */}
                <div className="mb-4 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                  <label className="text-sm font-semibold text-indigo-200 mb-2 block">🎯 Conclusione</label>
                  <textarea
                    value={articleData.article.conclusion}
                    onChange={(e) => updateArticleField('conclusion', e.target.value)}
                    rows={4}
                    className="w-full bg-slate-800/50 border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-indigo-200/90 focus:outline-none focus:border-indigo-400 resize-none"
                  />
                </div>

                {/* Keywords SEO */}
                <div className="mb-4">
                  <div className="text-xs text-violet-400 mb-2">Keywords SEO</div>
                  <div className="flex flex-wrap gap-1">
                    {articleData.article.seoKeywords.map((keyword: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded-full text-xs"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Social Suggestions */}
                <details className="mb-4">
                  <summary className="text-xs text-violet-400 cursor-pointer hover:text-violet-300 font-medium">
                    📱 Post Social Suggeriti
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="p-2 bg-pink-900/20 border border-pink-500/30 rounded-lg">
                      <div className="text-xs text-pink-400 mb-1">Instagram</div>
                      <p className="text-xs text-pink-200/80">{articleData.article.socialSuggestions.instagram.substring(0, 150)}...</p>
                    </div>
                    <div className="p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                      <div className="text-xs text-blue-400 mb-1">Facebook</div>
                      <p className="text-xs text-blue-200/80">{articleData.article.socialSuggestions.facebook.substring(0, 150)}...</p>
                    </div>
                    <div className="p-2 bg-sky-900/20 border border-sky-500/30 rounded-lg">
                      <div className="text-xs text-sky-400 mb-1">LinkedIn</div>
                      <p className="text-xs text-sky-200/80">{articleData.article.socialSuggestions.linkedin.substring(0, 150)}...</p>
                    </div>
                  </div>
                </details>

                {/* Hashtags */}
                <div className="mb-4">
                  <div className="text-xs text-violet-400 mb-2">Hashtags</div>
                  <div className="flex flex-wrap gap-1">
                    {articleData.article.socialSuggestions.hashtags.map((hashtag: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs"
                      >
                        {hashtag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pulsanti Download e Pubblica */}
                <div className="space-y-3">
                  {articleData.imageUrl && (
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = articleData.imageUrl;
                        link.download = `articolo-${Date.now()}.png`;
                        link.click();
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white font-medium rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Immagine Copertina</span>
                    </button>
                  )}

                  {/* Pulsanti Pubblica e Programma */}
                  <div className="flex gap-2">
                    <button
                      onClick={handlePublishArticle}
                      disabled={isPublishingArticle || !articleData.imageUrl}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isPublishingArticle ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Pubblicazione...</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-5 w-5" />
                          <span>Pubblica Subito</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => openScheduleModal('article')}
                      disabled={!articleData.imageUrl}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      title="Programma pubblicazione"
                    >
                      <Calendar className="h-5 w-5" />
                      <span>Programma</span>
                    </button>
                  </div>

                  {/* Separatore YouTube */}
                  <div className="border-t border-red-500/30 pt-4 mt-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Youtube className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-semibold text-red-400">Video YouTube</span>
                    </div>

                    {/* Avviso: pubblica prima l'articolo */}
                    {!articleData.isPublished && !articleVideoData?.dataUrl && (
                      <div className="mb-3 p-3 bg-amber-900/30 border border-amber-500/50 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-amber-200 font-medium">Prima pubblica l'articolo!</p>
                            <p className="text-xs text-amber-300/80 mt-1">
                              Per includere il link all'articolo nella descrizione del video YouTube,
                              devi prima pubblicare l'articolo sul blog.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* URL articolo pubblicato */}
                    {articleData.isPublished && articleData.blogPostUrl && (
                      <div className="mb-3 p-2 bg-green-900/30 border border-green-500/50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <span className="text-xs text-green-300">Articolo pubblicato</span>
                        </div>
                        <a
                          href={articleData.blogPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-400 hover:text-green-300 truncate block mt-1"
                        >
                          {articleData.blogPostUrl}
                        </a>
                      </div>
                    )}

                    {/* Se non c'è video, mostra pulsante genera */}
                    {!articleVideoData?.dataUrl && (
                      <button
                        onClick={handleGenerateArticleVideo}
                        disabled={isGeneratingArticleVideo || isPollingArticleVideo || !articleData.imageUrl || !articleData.isPublished}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        {isGeneratingArticleVideo || isPollingArticleVideo ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{isPollingArticleVideo ? 'Generazione video...' : 'Avvio...'}</span>
                          </>
                        ) : (
                          <>
                            <Video className="h-5 w-5" />
                            <span>Genera Video per YouTube</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Progress generazione video */}
                    {articleVideoProgress.length > 0 && !articleVideoData?.dataUrl && (
                      <div className="mt-2 bg-slate-900/50 rounded-lg p-3 border border-red-500/30">
                        <div className="space-y-1">
                          {articleVideoProgress.map((msg, idx) => (
                            <div key={idx} className="text-xs text-red-200">
                              {msg}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Video generato - preview e pubblica */}
                    {articleVideoData?.dataUrl && (
                      <div className="space-y-3">
                        {/* Preview Video */}
                        <div className="relative">
                          <video
                            src={articleVideoData.dataUrl}
                            controls
                            className="w-full rounded-lg border border-red-500/50"
                          />
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            Video Pronto
                          </div>
                        </div>

                        {/* Pulsanti Download e Pubblica YouTube */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = articleVideoData.dataUrl!;
                              link.download = `articolo-video-${Date.now()}.mp4`;
                              link.click();
                            }}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download</span>
                          </button>
                          <button
                            onClick={handlePublishArticleYouTube}
                            disabled={isPublishingArticleYouTube}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          >
                            {isPublishingArticleYouTube ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Pubblicando...</span>
                              </>
                            ) : (
                              <>
                                <Youtube className="h-5 w-5" />
                                <span>Pubblica su YouTube</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Risultato pubblicazione YouTube */}
                        {articleYoutubeResult && (
                          <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <CheckCircle2 className="h-5 w-5 text-green-400" />
                              <span className="text-sm font-semibold text-green-300">Pubblicato su YouTube!</span>
                            </div>
                            <p className="text-xs text-green-200 mb-2">{articleYoutubeResult.youtubeTitle}</p>
                            {articleYoutubeResult.videoUrl && (
                              <a
                                href={articleYoutubeResult.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 text-xs text-red-400 hover:text-red-300"
                              >
                                <Youtube className="h-3 w-3" />
                                <span>Guarda su YouTube</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Pulsante per rigenerare video */}
                        <button
                          onClick={() => {
                            setArticleVideoData(null);
                            setArticleVideoProgress([]);
                            setArticleYoutubeResult(null);
                          }}
                          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>Rigenera Video</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Pubblicazione */}
                  {articlePublishProgress.length > 0 && (
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-violet-500/30">
                      <div className="space-y-1">
                        {articlePublishProgress.map((msg, idx) => (
                          <div key={idx} className="text-xs text-violet-200">
                            {msg}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductSelector
        isOpen={isProductSelectorOpen}
        onClose={() => setIsProductSelectorOpen(false)}
        onSelect={handleProductSelect}
      />

      {result && (
        <ShareMenu
          isOpen={isShareMenuOpen}
          onClose={() => setIsShareMenuOpen(false)}
          caption={result.copywriting.caption}
          hashtags={result.copywriting.hashtags}
          cta={result.copywriting.cta}
          imageUrl={result.image?.dataUrl}
          videoUrl={result.video?.dataUrl}
          platform={socialPlatform}
        />
      )}

      {/* Modal Programmazione */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-6 w-6 text-amber-400" />
                <h3 className="text-xl font-bold text-white">Programma Pubblicazione</h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              Il post verrà salvato in Odoo e pubblicato automaticamente alla data e ora selezionate.
            </p>

            <div className="space-y-4">
              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-amber-300 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Data di pubblicazione
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-slate-800 border border-amber-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                />
              </div>

              {/* Ora */}
              <div>
                <label className="block text-sm font-medium text-amber-300 mb-2">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Ora di pubblicazione
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-amber-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                />
              </div>

              {/* Riepilogo */}
              {scheduledDate && scheduledTime && (
                <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-sm text-amber-200">
                    Il post verrà pubblicato il{' '}
                    <span className="font-semibold text-amber-100">
                      {new Date(scheduledDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>{' '}
                    alle{' '}
                    <span className="font-semibold text-amber-100">{scheduledTime}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Pulsanti */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(null)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleSchedulePost(showScheduleModal)}
                disabled={isScheduling || !scheduledDate || !scheduledTime}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Programmazione...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="h-5 w-5" />
                    <span>Conferma</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

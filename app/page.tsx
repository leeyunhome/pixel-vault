'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface ImageRecord {
  id: string;
  filename: string;
  url: string;
  title: string;
  description: string;
  created_at: string; // Database table uses snake_case
}

export default function Home() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [rouletteImage, setRouletteImage] = useState<ImageRecord | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .order('created_at', { ascending: false }); // 최신 순 정렬

      if (error) throw error;
      setImages(data as ImageRecord[]);
    } catch (e) {
      console.error('Failed to fetch images:', e);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setUploading(true);

    try {
      // 1. 파일 이름 안전하게 변환
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}_${cleanFileName}`;
      const bucketName = 'gallery';

      // 2. Storage에 이미지 업로드
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(uniqueFilename, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. 업로드된 파일의 Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(uniqueFilename);

      // 4. Database에 메타데이터 저장
      const { error: dbError } = await supabase
        .from('images')
        .insert([{
          filename: uniqueFilename,
          url: publicUrl,
          title: title,
          description: description
        }]);

      if (dbError) {
         // DB 저장 실패 시 스토리지 파일 정리
         await supabase.storage.from(bucketName).remove([uniqueFilename]);
         throw dbError;
      }

      // 업로드 완료 후 새로고침 및 폼 초기화
      fetchImages();
      setTitle('');
      setDescription('');
      setFile(null);
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (e: unknown) {
      console.error('Upload Error:', e);
      const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
      alert(`업로드 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async (img: ImageRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!navigator.share) {
      alert('이 브라우저에서는 공유 기능을 지원하지 않습니다. (모바일 브라우저를 이용해 주세요)');
      return;
    }

    try {
      await navigator.share({
        title: img.title || '신혼밥 갤러리 🍱💖',
        text: `${img.title ? img.title + ': ' : ''}${img.description || '우리의 맛있는 식탁 기록장'}`,
        url: window.location.href,
      });
    } catch (err) {
      console.log('공유 실패:', err);
    }
  };

  const startRoulette = () => {
    if (images.length === 0) {
      alert('등록된 사진이 없습니다!');
      return;
    }
    
    // 애니메이션 효과를 위해 여러 번 바꿈
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * images.length);
      setRouletteImage(images[randomIndex]);
      count++;
      if (count > 10) {
        clearInterval(interval);
      }
    }, 100);
  };

  const handleDelete = async (id: string, filename: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 모달 켜짐 방지
    if (!confirm('정말 이 이미지를 삭제하시겠습니까?')) return;

    try {
      // 1. Storage에서 원본 파일 삭제
      const bucketName = 'gallery';
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filename]);
      
      if (storageError) console.warn('스토리지 삭제 중 문제 발생:', storageError);

      // 2. Database에서 기록 삭제
      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      // 화면에서 이미지 제거
      setImages(prev => prev.filter(img => img.id !== id));
      if (selectedImage?.id === id) setSelectedImage(null);

    } catch (e: unknown) {
      console.error('Delete Error:', e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">신혼밥 갤러리 🍱💖</h1>
        
        {/* Upload Form */}
        <div className="flex flex-col md:flex-row gap-6 mb-10">
          <form onSubmit={handleUpload} className="bg-white p-6 rounded-lg shadow-md flex-1 border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">새 이미지 업로드</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">사진 선택 <span className="text-red-500">*</span></label>
              <input 
                id="file-input"
                type="file" 
                accept="image/*" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 cursor-pointer"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">제목 (선택)</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 부산 여행"
                className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="사진에 대한 설명을 적어주세요."
                rows={2}
                className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            <button 
              type="submit" 
              disabled={uploading || !file}
              className="w-full bg-blue-600 text-white font-medium py-2 rounded shadow hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? '업로드 중...' : '이미지 저장하기'}
            </button>
          </form>

          {/* Roulette Feature */}
          <div className="bg-gradient-to-br from-pink-500 to-orange-400 p-6 rounded-lg shadow-md w-full md:w-72 flex flex-col items-center justify-center text-white">
            <h2 className="text-xl font-bold mb-4">오늘 뭐 먹지? 🎲</h2>
            <p className="text-sm text-center mb-6 opacity-90">고민될 땐 신혼밥 룰렛을 돌려보세요!</p>
            <button 
              onClick={startRoulette}
              className="bg-white text-orange-600 font-bold px-8 py-3 rounded-full shadow-lg hover:bg-orange-50 transition transform hover:scale-105 active:scale-95"
            >
              룰렛 돌리기
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        {images.length === 0 ? (
          <p className="text-center text-gray-500 bg-white p-8 rounded shadow-sm border border-gray-100">아직 등록된 이미지가 없습니다. 첫 사진을 올려보세요!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((img) => (
              <div 
                key={img.id} 
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-pointer group flex flex-col border border-gray-100"
                onClick={() => setSelectedImage(img)}
              >
                <div className="aspect-square bg-gray-200 relative overflow-hidden">
                  <img 
                    src={img.url} 
                    alt={img.title || img.filename} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                    loading="lazy"
                  />
                  {/* Overlay Buttons */}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    {/* Share Button */}
                    <button
                      onClick={(e) => handleShare(img, e)}
                      className="bg-blue-500 text-white p-2 rounded-full shadow hover:bg-blue-600"
                      title="공유하기"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(img.id, img.filename, e)}
                      className="bg-red-500 text-white p-2 rounded-full shadow hover:bg-red-600"
                      title="삭제"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-4 flex-1">
                  <h3 className="font-semibold text-lg truncate text-gray-800">{img.title || '제목 없음'}</h3>
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">{img.description || '설명이 없습니다.'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-50 p-4 sm:p-8"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition p-2 bg-black/20 rounded-full"
            onClick={() => setSelectedImage(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div 
            className="max-w-5xl w-full flex flex-col items-center justify-center bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-center max-h-[70vh] mb-6">
              <img 
                src={selectedImage.url} 
                alt={selectedImage.title} 
                className="max-w-full max-h-full object-contain shadow-2xl rounded"
              />
            </div>
            
            <div className="w-full max-w-3xl bg-white/10 backdrop-blur-md p-6 rounded-xl text-white border border-white/20 shadow-xl">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold">{selectedImage.title || '제목 없음'}</h2>
                <button 
                  onClick={(e) => handleShare(selectedImage, e)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  공유하기
                </button>
              </div>
              {selectedImage.description ? (
                <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">{selectedImage.description}</p>
              ) : (
                <p className="text-gray-400 italic">설명이 없습니다.</p>
              )}
              <p className="text-gray-400 text-xs mt-4">
                업로드: {new Date(selectedImage.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Roulette Modal Overlay */}
      {rouletteImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4 sm:p-8"
          onClick={() => setRouletteImage(null)}
        >
          <div className="animate-bounce mb-4 text-4xl">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-6 text-center">오늘의 추천 메뉴!</h2>
          <div 
            className="max-w-2xl w-full flex flex-col items-center justify-center bg-white p-4 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-center max-h-[50vh] mb-4 overflow-hidden rounded-xl">
              <img 
                src={rouletteImage.url} 
                alt={rouletteImage.title} 
                className="max-w-full object-contain"
              />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">{rouletteImage.title || '이름 없는 메뉴'}</h3>
            <p className="text-gray-600 text-center">{rouletteImage.description || '맛있는 식사 되세요!'}</p>
            <button 
              onClick={() => setRouletteImage(null)}
              className="mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-8 rounded-full transition"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

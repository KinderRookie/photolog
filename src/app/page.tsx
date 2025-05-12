'use client';
type DirectoryProps = {
  webkitdirectory?: boolean;
  directory?: boolean;
};
const directoryProps: DirectoryProps = {
  webkitdirectory: true,
  directory: true,
};
import Image from "next/image";
import React, { useState, useRef, useEffect } from 'react';

import frame1Img from '../assets/frame1/frame.png';
import frame1Info from '../assets/frame1/info.json';
import frame2Img from '../assets/frame2/frame.png';
import frame2Info from '../assets/frame2/info.json';
import frame3Img from '../assets/frame3/frame.png';
import frame3Info from '../assets/frame3/info.json';

const frames = [
  { frame: frame1Img, info: frame1Info },
  { frame: frame2Img, info: frame2Info },
  { frame: frame3Img, info: frame3Info },
] as const;

function PhotoFrameEditor({
  frame,
  frameInfo,
}: {
  frame: typeof frame1Img;
  frameInfo: typeof frame1Info;
}) {
  // original frame dimensions from imported asset
  const originalWidth = frame.width;
  const originalHeight = frame.height;
  // 1) 전체 이미지 목록
  const [images, setImages] = useState<{ file: File; url: string; rotation: number }[]>([]);
  // 2) 사용자가 입력한 좌표
  const [coords, _] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // 3) 배치된 아이템들: {url, rotation, xPct, yPct, wPct, hPct} 리스트
  const [placedItems, setPlacedItems] = useState<
    Array<{ url: string; rotation: number; xPct: number; yPct: number; wPct: number; hPct: number }>
  >([]);
  // region selection state
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);

  // responsive split pane state
  const minRightWidth = 300; // 최소 우측 영역 너비(px)
  // const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.6);
  const [leftWidth, setLeftWidth] = useState(0);
  useEffect(() => {
  setLeftWidth(window.innerWidth * 0.6);
  }, []);
  const draggingRef = useRef(false);

  const onMouseDownDivider = () => { draggingRef.current = true; };
  const onMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    let newLeft = e.clientX;
    const maxLeft = window.innerWidth - minRightWidth;
    if (newLeft < 100) newLeft = 100;
    if (newLeft > maxLeft) newLeft = maxLeft;
    setLeftWidth(newLeft);
  };
  const onMouseUp = () => { draggingRef.current = false; };

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // JSON 기반 영역을 % 단위로 계산
  const regions = frameInfo.coordinates.map(({ x, y, width, height }) => ({
    xPct: x / originalWidth,
    yPct: y / originalHeight,
    wPct: width / originalWidth,
    hPct: height / originalHeight,
  }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폴더(다중 파일) 열기
  const openFolder = () => {
    fileInputRef.current?.click();
  };

  // 폴더 선택 후 이미지 로딩
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const imgs = Array.from(e.target.files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ file: f, url: URL.createObjectURL(f), rotation: 0 }));
    setImages(imgs);
  };

  // 썸네일 클릭 → 현재 coords 위치에 배치
  const handleThumbnailClick = (idx: number) => {
    const { url, rotation } = images[idx];
    if (selectedRegion === null) {
      return;
    }
    const regionOriginal = selectedRegion !== null ? frameInfo.coordinates[selectedRegion] : null;
    const defaultW = 100;
    const defaultH = 100;
    setPlacedItems((prev) => [
      ...prev,
      {
        url,
        rotation,
        xPct: regionOriginal ? regionOriginal.x / originalWidth : coords.x / originalWidth,
        yPct: regionOriginal ? regionOriginal.y / originalHeight : coords.y / originalHeight,
        wPct: regionOriginal ? regionOriginal.width / originalWidth : defaultW / originalWidth,
        hPct: regionOriginal ? regionOriginal.height / originalHeight : defaultH / originalHeight,
      },
    ]);
  };

  const handleRotate = (idx: number) => {
    setImages((prev) =>
      prev.map((img, i) =>
        i === idx ? { ...img, rotation: (img.rotation + 90) % 360 } : img
      )
    );
  };

  // 미리보기 캡처 & 저장
  const handleSave = async () => {
    // 1) 선택 해제
    setSelectedRegion(null);

    // 2) Off‐screen 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 3) 프레임 이미지 로드 & 그리기
    await new Promise<void>((res) => {
      const img = new window.Image();
      img.src = frame.src;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
        res();
      };
    });

    // 4) 배치된 아이템들 그리기 (with cropping)
    for (const item of placedItems) {
    await new Promise<void>((res) => {
      const img = new window.Image();
      img.src = item.url;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const dx = item.xPct * originalWidth;
        const dy = item.yPct * originalHeight;
        const dW = item.wPct * originalWidth;
        const dH = item.hPct * originalHeight;

        // 1) Draw the image rotated into an offscreen canvas
        const offCanvas = document.createElement('canvas');
        // Swap dimensions for 90/270° rotation
        if (item.rotation % 180 === 90) {
          offCanvas.width = img.height;
          offCanvas.height = img.width;
        } else {
          offCanvas.width = img.width;
          offCanvas.height = img.height;
        }
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          offCtx.translate(offCanvas.width / 2, offCanvas.height / 2);
          offCtx.rotate((item.rotation * Math.PI) / 180);
          offCtx.drawImage(img, -img.width / 2, -img.height / 2);
        }

        // 2) Crop the rotated image to fill the frame area (center-crop)
        const rotW = offCanvas.width;
        const rotH = offCanvas.height;
        const frameRatio = dW / dH;
        const imgRatio = rotW / rotH;
        let sx = 0, sy = 0, sWidth = rotW, sHeight = rotH;

        if (imgRatio > frameRatio) {
          // Wider than frame: crop horizontally
          sWidth = rotH * frameRatio;
          sx = (rotW - sWidth) / 2;
        } else {
          // Taller than frame: crop vertically
          sHeight = rotW / frameRatio;
          sy = (rotH - sHeight) / 2;
        }

        // 3) Draw cropped, rotated image into main canvas
        ctx.drawImage(offCanvas, sx, sy, sWidth, sHeight, dx, dy, dW, dH);
        res();
      };
    });
    }

    // 5) 파일로 저장
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'composed-frame.jpg';
      link.click();
    }, 'image/jpeg', 1.0);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 좌측 패널: 가변 너비 */}
      <div style={{ width: leftWidth, padding: 16, borderRight: '1px solid #ccc', overflowY: 'auto', boxSizing: 'border-box' }}>
        {/* 왼쪽: 썸네일 목록 */}
        <button
          onClick={openFolder}
          title="폴더 선택"
          style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          📁
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          multiple
          onChange={handleFolderSelect}
          {...directoryProps}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginTop: 12,
          }}
        >
          {images.map((img, idx) => (
            <div
              key={idx}
              onClick={() => handleThumbnailClick(idx)}
              style={{
                border: '1px solid #ddd',
                borderRadius: 4,
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <img
                src={img.url}
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  transform: `rotate(${img.rotation}deg)`,
                  transformOrigin: 'center center',
                }}              />
              <button
                onClick={(e) => { e.stopPropagation(); handleRotate(idx); }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                🔄
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* 드래그 가능한 칸막이 */}
      <div
        onMouseDown={onMouseDownDivider}
        style={{ width: 5, cursor: 'col-resize', background: '#ddd' }}
      />
      {/* 우측 패널: 최소 너비 지정 */}
      <div style={{ flex: 1, minWidth: minRightWidth, padding: 32, boxSizing: 'border-box', overflow: 'auto' }}>
        <button
          onClick={handleSave}
          style={{ marginBottom: 12, backgroundColor: "gray", borderRadius:8 ,padding: '8px 16px', cursor: 'pointer' }}
        >
          저장
        </button>

        {/* 프레임 미리보기 */}
        <div
          id="photo-preview"
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${originalWidth} / ${originalHeight}`,
            backgroundImage: `url(${frame.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid #aaa',
            margin: '0 auto',
          }}
        >
          {placedItems.map((item, idx) => (
            <img
              key={idx}
              src={item.url}
              alt=""
              style={{
                position: 'absolute',
                left: `${item.xPct * 100}%`,
                top: `${item.yPct * 100}%`,
                width: `${item.wPct * 100}%`,
                height: `${item.hPct * 100}%`,
                objectFit: 'cover',
                transform: `rotate(${item.rotation}deg)`,
                transformOrigin: 'center center',
              }}
            />
          ))}
          {regions.map((reg, idx) => (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRegion((prev) => (prev === idx ? null : idx));
              }}
              style={{
                position: 'absolute',
                left: `${reg.xPct * 100}%`,
                top: `${reg.yPct * 100}%`,
                width: `${reg.wPct * 100}%`,
                height: `${reg.hPct * 100}%`,
                border: selectedRegion === idx ? '2px solid red' : '1px solid rgba(255,255,255,0.5)',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);

  return (
    <div>
      {/* Frame selection icons */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
        {frames.map((f, idx) => (
          <img
            key={idx}
            src={f.frame.src}
            alt={`Frame ${idx + 1}`}
            width={50}
            height={50}
            onClick={() => setSelectedFrameIdx(idx)}
            style={{
              cursor: 'pointer',
              border: selectedFrameIdx === idx ? '2px solid blue' : '1px solid gray',
              borderRadius: 4,
              margin: '0 8px',
            }}
          />
        ))}
      </div>
      {/* Editor for selected frame */}
      <PhotoFrameEditor
        key={selectedFrameIdx}
        frame={frames[selectedFrameIdx].frame}
        frameInfo={frames[selectedFrameIdx].info}
      />
    </div>
  );
}
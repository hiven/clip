import classNames from "classnames";
import {RefObject, useEffect, useRef, useState} from "react";
import {t} from "../src/intl";

export interface Crop {
  start: number;
  duration: number;
}

export interface TimelineProps {
  frame: Crop;
  width: number;
  height: number;
  limit?: number;
  value: Crop;
  onChange?: (crop: Crop) => void;
  onBlur?: (crop: Crop) => void;
  disabled?: boolean;
  picInt?: number;
  pics?: string[];
}

export function Timeline({frame, width, height, limit, value, onChange, onBlur, disabled, pics, picInt}: TimelineProps) {
  const duration = limit ? Math.min(limit, frame.duration) : frame.duration;
  const [initialPicsLength] = useState(pics?.length ?? 0);

  const wrapperRef = useRef() as RefObject<HTMLDivElement>;
  const bodyRef = useRef() as RefObject<HTMLDivElement>
  const leftRef = useRef() as RefObject<HTMLDivElement>;
  const rightRef = useRef() as RefObject<HTMLDivElement>;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const body = bodyRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!wrapper || !body || !left || !right) {
      return;
    }

    const createDragHandler = (moveHandler: (event: { initialValue: Crop, valueChange: number }) => Crop) => {
      return ({clientX}: MouseEvent) => {
        const rect = wrapper.getBoundingClientRect();
        const initialValue = {...valueRef.current};
        const initialPosition = (clientX - rect.left) / rect.width * frame.duration + frame.start;
        const wrappedHandler = ({clientX}: MouseEvent) => {
          const position = (clientX - rect.left) / rect.width * frame.duration + frame.start;
          const valueChange = position - initialPosition;
          valueRef.current = moveHandler({initialValue, valueChange});
          onChange?.(valueRef.current);
        };
        const detachHandler = () => {
          wrapper.ownerDocument.removeEventListener("mousemove", wrappedHandler);
          wrapper.ownerDocument.removeEventListener("mouseup", detachHandler);
          wrapper.ownerDocument.defaultView?.removeEventListener("blur", detachHandler);
          onBlur?.(valueRef.current);
        };
        wrapper.ownerDocument.addEventListener("mousemove", wrappedHandler);
        wrapper.ownerDocument.addEventListener("mouseup", detachHandler);
        wrapper.ownerDocument.defaultView?.addEventListener("blur", detachHandler);
      }
    };

    const bodyHandler = createDragHandler(({initialValue, valueChange}) => {
      return {
        start: clamp(initialValue.start + valueChange, frame.start, frame.start + frame.duration - initialValue.duration),
        duration: initialValue.duration,
      };
    });

    const leftHandler = createDragHandler(({initialValue, valueChange}) => {
      const limitedChange = clamp(
        valueChange,
        Math.max(initialValue.duration - duration, -initialValue.start),
        initialValue.duration,
      );
      return {
        start: initialValue.start + limitedChange,
        duration: initialValue.duration - limitedChange,
      };
    });

    const rightHandler = createDragHandler(({initialValue, valueChange}) => {
      const limitedChange = clamp(
        valueChange,
        -initialValue.duration,
        Math.min(duration - initialValue.duration, frame.start + frame.duration - initialValue.start - initialValue.duration),
      );
      return {
        start: initialValue.start,
        duration: initialValue.duration + limitedChange,
      };
    });

    body.addEventListener("mousedown", bodyHandler);
    left.addEventListener("mousedown", leftHandler);
    right.addEventListener("mousedown", rightHandler);
    return () => {
      body.removeEventListener("mousedown", bodyHandler);
      left.removeEventListener("mousedown", leftHandler);
      right.removeEventListener("mousedown", rightHandler);
    };
  }, [frame.start, frame.duration, duration, onChange, onBlur]);

  const [cursor, setCursor] = useState<number | undefined>();
  const updateCursor = ({clientX}: { clientX: number }) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setCursor((clientX - rect.left) / rect.width * frame.duration + frame.start);
  };

  const left = (value.start - frame.start) / frame.duration;
  const right = (value.start + value.duration - frame.start) / frame.duration;
  return <>
    <div className="w-full rounded-2xl overflow-hidden relative bg-slate-100" style={{aspectRatio: `${width} / ${height}`}}>
      {pics?.length
        ? <img src={cursor && picInt && pics[Math.floor(cursor / picInt)] || pics[0]} alt="preview" className="absolute w-full h-full object-contain"/>
        : <div className="p-4 text-center">{t('timeline.no_preview')}</div>}
    </div>
    <div className="h-16 mt-2 bg-black bg-slate-800 rounded-2xl overflow-hidden relative select-none" ref={wrapperRef} onMouseMove={updateCursor}>
      <div className="absolute inset-0 flex flex-row">
        {picInt && pics?.map((pic, index) => {
          const className = classNames('object-cover h-full', {'motion-safe:animate-fly-in': index >= initialPicsLength});
          return <img key={pic} src={pic} alt="" className={className} style={{width: `${picInt / frame.duration * 100}%`}}/>;
        })}
      </div>
      <div className="absolute inset-0 shadow-inner" />
      <div className="h-full bg-red-800/0 absolute cursor-move" ref={bodyRef} style={{left: `${left * 100}%`, right: `${100 - right * 100}%`}}/>
      <div className="h-full bg-red-800/70 absolute backdrop-grayscale backdrop-contrast-200" style={{left: `0%`, right: `${100 - left * 100}%`}}/>
      <div className="h-full bg-red-800/70 absolute backdrop-grayscale backdrop-contrast-200" style={{left: `${right * 100}%`, right: `0%`}}/>
      {cursor !== undefined && <div className="w-0.5 h-full -mx-0.25 bg-black/50 absolute pointer-events-none" style={{left: `${cursor / frame.duration * 100}%`}}/>}
      <div className="h-full w-2 bg-red-800 absolute cursor-col-resize" ref={leftRef} style={{left: `${left * 100}%`}}/>
      <div className="h-full w-2 bg-red-800 absolute cursor-col-resize" ref={rightRef} style={{right: `${100 - right * 100}%`}}/>
    </div>
    <div className="flex flex-row justify-between">
      <div>
        <label htmlFor="start">{t('timeline.start_time')} </label>
        <input type="number" id="start" disabled={disabled} className="w-20 bg-transparent text-right"
               value={value.start.toFixed(3)}
               step="0.001" min={frame.start.toFixed(3)} max={(frame.start + frame.duration - value.duration).toFixed(3)}
               onInput={e => onChange?.({start: parseFloat(e.currentTarget.value), duration: value.duration})}/>
      </div>
      <div>
        <label htmlFor="duration">{t('timeline.duration')} </label>
        <input type="number" id="duration" disabled={disabled} className="w-20 bg-transparent text-right"
               value={value.duration.toFixed(3)}
               step="0.001" min="0.000" max={duration.toFixed(3)}
               onInput={e => onChange?.({start: value.start, duration: parseFloat(e.currentTarget.value)})}/>
      </div>
      <div>
        <label htmlFor="end">{t('timeline.end_time')} </label>
        <input type="number" id="end" disabled={disabled} className="w-20 bg-transparent text-right"
               value={(value.start + value.duration).toFixed(3)}
               step="0.001" min={frame.start.toFixed(3)} max={(frame.start + frame.duration).toFixed(3)}
               onInput={e => onChange?.({start: value.start, duration: parseFloat(e.currentTarget.value) - value.duration})}/>
      </div>
    </div>
  </>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

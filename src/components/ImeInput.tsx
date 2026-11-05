// 修复：按 verbatimModuleSyntax 规范，类型单独用 import type 导入
import { useRef, useState, useCallback } from 'react';
import type { ChangeEvent, CompositionEvent, InputHTMLAttributes } from 'react';

/**
 * IME-safe input hook
 * 解决中文/日文/韩文输入法在 React 受控输入框中的冲突问题。
 * 在输入法组合期间（composing）不触发外部 onChange，
 * 等 compositionend 后再同步最终值。
 */
export function useImeInput(
  value: string,
  onChange: (v: string) => void
) {
  const composingRef = useRef(false);
  // 组合期间的临时显示值
  const [localValue, setLocalValue] = useState(value);

  // 当外部 value 变化时同步（非组合期间）
  const syncedValue = composingRef.current ? localValue : value;

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (!composingRef.current) {
      onChange(e.target.value);
    }
  }, [onChange]);

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    const v = (e.target as HTMLInputElement).value;
    setLocalValue(v);
    onChange(v);
  }, [onChange]);

  return {
    value: syncedValue,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  };
}

/**
 * IME-safe input component
 * 直接替换普通 <input>，用法完全相同，额外支持中文输入法。
 */
interface ImeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (v: string) => void;
}

export function ImeInput({ value, onChange, ...rest }: ImeInputProps) {
  const imeProps = useImeInput(value, onChange);
  return <input {...rest} {...imeProps} />;
}
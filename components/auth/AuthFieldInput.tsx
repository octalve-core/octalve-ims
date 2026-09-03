"use client";

import type React from "react";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTH_FIELD_SHELL_CLASS } from "@/components/auth/auth-glass-styles";

/** REQ-0231 — Suite Portal reskin: icon-left field shell matching AuthFields.FieldInput. */
export function AuthFieldInput({
  label,
  icon,
  right,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-700 dark:text-white/80">
        {label}
      </span>

      <div className={cn("group", AUTH_FIELD_SHELL_CLASS, className)}>
        {icon ? (
          <span className="grid shrink-0 place-items-center text-slate-400 dark:text-white/40 transition group-focus-within:text-[#0064E0] dark:group-focus-within:text-[#5ea1ff]">
            {icon}
          </span>
        ) : null}

        <input
          {...props}
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-slate-950 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-60"
        />

        {right}
      </div>
    </label>
  );
}

export function AuthPasswordInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  id,
  required,
}: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthFieldInput
      id={id}
      label={label}
      icon={<LockKeyhole size={18} strokeWidth={2} />}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      disabled={disabled}
      required={required}
      right={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-slate-400 dark:text-white/40 transition hover:bg-slate-50 dark:hover:bg-white/10 hover:text-[#0064E0] dark:hover:text-[#5ea1ff] disabled:cursor-not-allowed"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? (
            <EyeOff size={18} strokeWidth={2} />
          ) : (
            <Eye size={18} strokeWidth={2} />
          )}
        </button>
      }
    />
  );
}

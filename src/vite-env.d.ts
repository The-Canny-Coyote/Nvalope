/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- ambient stubs for optional UI deps */
/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module 'cmdk' {
  const Command: any;
  export { Command };
  export const CommandDialog: any;
  export const CommandInput: any;
  export const CommandList: any;
  export const CommandEmpty: any;
  export const CommandGroup: any;
  export const CommandItem: any;
  export const CommandSeparator: any;
}

declare module 'vaul' {
  const Drawer: any;
  export { Drawer };
  export const DrawerTrigger: any;
  export const DrawerPortal: any;
  export const DrawerClose: any;
  export const DrawerOverlay: any;
  export const DrawerContent: any;
  export const DrawerTitle: any;
  export const DrawerDescription: any;
}

declare module 'react-hook-form' {
  export function useForm<T = any>(options?: any): any;
  export function useFormContext<T = any>(): any;
  export function useFormState<T = any>(props?: any): any;
  export const Controller: any;
  export type ControllerProps<TFieldValues = any, TName = any> = any;
  export type FieldPath<T> = any;
  export type FieldValues = any;
  export const FormProvider: any;
  export const Form: any;
  export const FormField: any;
  export const FormItem: any;
  export const FormLabel: any;
  export const FormControl: any;
  export const FormMessage: any;
}

declare module 'input-otp' {
  export const InputOTP: any;
  export const InputOTPGroup: any;
  export const InputOTPSlot: any;
  export const OTPInput: any;
  export const OTPInputContext: any;
}

declare module 'react-resizable-panels' {
  export const PanelGroup: any;
  export const Panel: any;
  export const PanelResizeHandle: any;
}

declare module 'next-themes' {
  export function useTheme(): { theme: string; setTheme: (t: string) => void; resolvedTheme: string };
  export const ThemeProvider: any;
}

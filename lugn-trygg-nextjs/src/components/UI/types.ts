// Design System Types and Interfaces

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
export type InputState = 'default' | 'error' | 'success' | 'warning';
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type AlertVariant = 'info' | 'success' | 'warning' | 'error';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export interface InputProps extends BaseComponentProps {
  type?: InputType;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
  helperText?: string;
  state?: InputState;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export interface CardProps extends BaseComponentProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: boolean;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
}

export interface BadgeProps extends BaseComponentProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  dot?: boolean;
}

export interface AlertProps extends BaseComponentProps {
  variant?: AlertVariant;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
  overlay?: boolean;
  variant?: 'spinner' | 'pulse' | 'dots';
}
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface WhatsAppState {
  status: 'Connected' | 'Disconnected' | 'Connecting' | 'Session Expired';
  qrCode: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: WhatsAppState = {
  status: 'Disconnected',
  qrCode: '',
  isLoading: false,
  error: null,
};

const whatsappSlice = createSlice({
  name: 'whatsapp',
  initialState,
  reducers: {
    updateStatus: (
      state,
      action: PayloadAction<{ status: WhatsAppState['status']; qrCode: string }>
    ) => {
      state.status = action.payload.status;
      state.qrCode = action.payload.qrCode;
    },
    setSessionLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setSessionError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { updateStatus, setSessionLoading, setSessionError } = whatsappSlice.actions;
export default whatsappSlice.reducer;

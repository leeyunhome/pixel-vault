import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; // 브라우저에서는 익명 키(ANON_KEY)를 사용해야 합니다.

export const supabase = createClient(supabaseUrl, supabaseKey);
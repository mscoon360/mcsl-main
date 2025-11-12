import { supabase } from '@/integrations/supabase/client';

export const customersToImport = [
  {
    name: 'Gulf City Limited',
    company: 'Gulf City Limited',
    address: 'Gulf City Avenue',
    address_2: 'Gulf View',
    city: 'La Romain',
    phone: '609-3077',
    zone: 'South',
  },
  {
    name: 'Crews Inn Limited',
    company: 'Crews Inn Limited',
    address: 'Chaguaramas Terminal Drive',
    address_2: 'Point Bourde',
    city: 'Chaguaramas',
    phone: '607-4000',
    zone: 'West',
  },
  {
    name: 'Trinidad Tissues',
    company: 'Trinidad Tissues',
    address: 'Lot C Lennox Yearwood',
    address_2: 'Expressway, Omeara Ind. Estate',
    city: 'Arima',
    phone: '643-5000',
    zone: 'East',
  },
  {
    name: 'IQOR Trinidad Ltd. {Barataria}',
    company: 'IQOR Trinidad Ltd. {Barataria}',
    address: '2nd Floor E-Teck Flagship',
    address_2: 'Complex Tamana in Tech Park',
    city: 'Wallerfield',
    phone: '390-9956',
    zone: 'East',
  },
  {
    name: 'IQOR Trinidad Ltd. {Chaguanas}',
    company: 'IQOR Trinidad Ltd. {Chaguanas}',
    address: '2nd Floor E-Teck Flagship',
    address_2: 'Complex Tamana in Tech Park',
    city: 'Wallerfield',
    phone: '390-9956',
    zone: 'Central',
  },
  {
    name: 'IQOR Trinidad Ltd. {Wallerfield}',
    company: 'IQOR Trinidad Ltd. {Wallerfield}',
    address: '2nd Floor E-Teck Flagship',
    address_2: 'Complex Tamana in Tech Park',
    city: 'Wallerfield',
    phone: '390-9956',
    zone: 'East',
  },
  {
    name: 'T&T Securities & Exchange Commission',
    company: 'T&T Securities & Exchange Commission',
    address: 'The Hyatt Regency Tower D',
    address_2: 'Level 22',
    city: 'Port of Spain',
    phone: '624-2991',
    zone: 'North',
  },
  {
    name: 'Tru-Fit Garment Factory Ltd. {Francis Fashion}',
    company: 'Tru-Fit Garment Factory Ltd. {Francis Fashion}',
    address: 'Century Drive',
    address_2: 'Trinicty Industrial Estate',
    city: 'Trincity',
    phone: '662-4810',
    zone: 'East',
  },
  {
    name: 'Tru-Fit Garment Factory Ltd. {Detour Stores}',
    company: 'Tru-Fit Garment Factory Ltd. {Detour Stores}',
    address: 'Century Drive',
    address_2: 'Trinicty Industrial Estate',
    city: 'Trincity',
    phone: '662-4810',
    zone: 'East',
  },
  {
    name: 'University of Southern Caribbean',
    company: 'University of Southern Caribbean',
    address: 'Royal Road',
    address_2: 'Maracas',
    city: 'St. Joseph',
    phone: '662-2241',
    zone: 'East',
  },
  {
    name: 'Weekenders Trinidad Ltd. {TGIF}',
    company: 'Weekenders Trinidad Ltd. {TGIF}',
    address: '#47-49 Sackville Street',
    address_2: '',
    city: 'Port of Spain',
    phone: '623-2646',
    zone: 'North',
  },
  {
    name: 'Unicomer Trinidad Ltd.',
    company: 'Unicomer Trinidad Ltd.',
    address: '#23 Mulchan Seuchan Road',
    address_2: '',
    city: 'Chaguanas',
    phone: '672-7577',
    zone: 'Central',
  },
];

export const importCustomers = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const customersWithUserId = customersToImport.map(customer => ({
    ...customer,
    user_id: user.id,
    status: 'active',
    vatable: false,
  }));

  const { data, error } = await supabase
    .from('customers')
    .insert(customersWithUserId)
    .select();

  if (error) throw error;
  
  return data;
};

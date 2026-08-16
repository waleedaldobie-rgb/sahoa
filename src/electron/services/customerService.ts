import { Customer } from '../../types';
import { normalizeMeasurements, normalizeStyleDetails } from '../../services/shared/measurementDefaults';
import { CustomerRepository, CustomerRow } from '../repositories/customerRepository';

const parseMeasurements = (value?: string) => {
  try { return normalizeMeasurements(JSON.parse(value || '{}')); }
  catch { return normalizeMeasurements(); }
};

const parseStyleDetails = (value?: string) => {
  try { return normalizeStyleDetails(JSON.parse(value || '{}')); }
  catch { return normalizeStyleDetails(); }
};

export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  list(): Customer[] {
    const historyMap = new Map<string, any[]>();
    for (const history of this.repository.listMeasurementHistory()) {
      const list = historyMap.get(history.customer_id) || [];
      list.push({
        id: history.id,
        savedAt: history.saved_at,
        note: history.note || '',
        measurements: parseMeasurements(history.measurements_json),
        styleDetails: parseStyleDetails(history.style_details_json)
      });
      historyMap.set(history.customer_id, list);
    }

    return this.repository.list().map((customer) => this.toCustomer(customer, historyMap.get(customer.id) || []));
  }

  create(input: Partial<Customer>): Customer {
    const id = input.id || `CUST-${Date.now()}`;
    const name = input.name || 'عميل جديد';
    const phone = (input.phone || '').trim();
    const createdAt = input.createdAt || new Date().toISOString().slice(0, 10);
    if (this.repository.findByPhone(phone)) throw new Error('رقم الجوال مسجل بالفعل لعميل آخر');

    const measurements = normalizeMeasurements(input.measurements);
    const styleDetails = normalizeStyleDetails(input.styleDetails);
    this.repository.insert({
      id,
      name,
      phone,
      createdAt,
      measurementsJson: JSON.stringify(measurements),
      styleDetailsJson: JSON.stringify(styleDetails)
    });
    return { id, name, phone, createdAt, measurements, styleDetails, measurementHistory: [] };
  }

  update(customer: Customer): boolean {
    const phone = (customer.phone || '').trim();
    if (this.repository.findByPhoneExcludingId(phone, customer.id)) throw new Error('رقم الجوال مسجل بالفعل لعميل آخر');
    this.repository.update({
      id: customer.id,
      name: customer.name,
      phone,
      measurementsJson: JSON.stringify(normalizeMeasurements(customer.measurements)),
      styleDetailsJson: JSON.stringify(normalizeStyleDetails(customer.styleDetails)),
      updatedAt: new Date().toISOString()
    });
    return true;
  }

  delete(id: string): boolean {
    this.repository.deleteById(id);
    return true;
  }

  saveMeasurementHistory(customerId: string, note: string): any {
    const customer = this.repository.findById(customerId);
    if (!customer) throw new Error('العميل غير موجود في قاعدة البيانات');
    const id = `HIST-${Date.now()}`;
    const savedAt = new Date().toISOString().slice(0, 10);
    const safeNote = note || 'تحديث مقاسات';
    this.repository.insertMeasurementHistory({
      id,
      customerId,
      savedAt,
      note: safeNote,
      measurementsJson: customer.measurements_json,
      styleDetailsJson: customer.style_details_json
    });
    return {
      id,
      savedAt,
      note,
      measurements: parseMeasurements(customer.measurements_json),
      styleDetails: parseStyleDetails(customer.style_details_json)
    };
  }

  private toCustomer(row: CustomerRow, measurementHistory: any[]): Customer {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      createdAt: row.created_at,
      measurements: parseMeasurements(row.measurements_json),
      styleDetails: parseStyleDetails(row.style_details_json),
      measurementHistory
    };
  }
}

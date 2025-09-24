export const mockDoctors = Array.from({length:8}).map((_,i)=>({
  id:i+1,
  name:`BS. Nguyễn Văn ${i+1}`,
  specialty:["Nội tổng quát","Nhi","Sản","Tim mạch"][i%4],
  rating:(4+(i%2)+0.2).toFixed(1),
  hospital:["TVN Clinic Q1","TVN Clinic Q7","TVN Hospital"][i%3],
}));
export const slots=["08:00","08:30","09:00","09:30","10:00","10:30","11:00","14:00","14:30","15:00","15:30","16:00"];
export const specialties=["Nội tổng quát","Nhi","Sản","Tim mạch","Tai mũi họng","Mắt","Da liễu","Nội tiết","Cơ xương khớp","Hô hấp","Tiêu hóa"];

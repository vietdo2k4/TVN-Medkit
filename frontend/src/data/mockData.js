/**
 * Dữ liệu giả để dựng UI khi chưa có backend.
 * Thay bằng fetch API khi tích hợp Node.js + MySQL.
 */
export const mockDoctors = Array.from({ length: 8 }).map((_, i) => ({
  id: i + 1,
  name: `BS. Nguyễn Văn ${i + 1}`,
  specialty: ["Nội tổng quát", "Nhi", "Sản", "Tim mạch"][i % 4],
  rating: (4 + (i % 2) + 0.2).toFixed(1),
  hospital: ["TVN Clinic Q1", "TVN Clinic Q7", "TVN Hospital"][i % 3],
}));

export const facilities = [
  { id: 1, name: "Bệnh viện Chợ Rẫy", address: "201B Nguyễn Chí Thanh, Q.5, TP.HCM" },
  { id: 2, name: "Bệnh viện Đại học Y Dược", address: "215 Hồng Bàng, Q.5, TP.HCM" },
  { id: 3, name: "Phòng khám Đa khoa Pasteur", address: "273 Pasteur, Q.3, TP.HCM" },
];

export const slots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00",
  "14:00", "14:30", "15:00", "15:30", "16:00"
];

export const specialties = [
  "Nội tổng quát", "Nhi", "Sản", "Tim mạch", "Tai mũi họng", "Mắt",
  "Da liễu", "Nội tiết", "Cơ xương khớp", "Hô hấp", "Tiêu hóa"
];


export const doctors = [
  {
    id: 1,
    name: "BS CKI. Vũ Thị Hà",
    degree: "BS CKI.",
    specialty: "Mắt",
    price: 150000,
    rating: 4.0,
    visits: 30,
    hospital: "Bác sĩ Chuyên Khoa",
    photo: "/assets/images/doctors/bs1.jpg",
  },
  {
    id: 2,
    name: "ThS. BS. Lê Hoàng Thiên",
    degree: "ThS. BS.",
    specialty: "Nội tổng quát",
    price: 149000,
    rating: 4.0,
    visits: 40,
    hospital: "Bác sĩ Chuyên Khoa",
    photo: "/assets/images/doctors/bs2.jpg",
  },
  {
    id: 3,
    name: "BS CKI. Đỗ Đăng Khoa",
    degree: "BS CKI.",
    specialty: "Tim mạch can thiệp",
    price: 200000,
    rating: 4.4,
    visits: 75,
    hospital: "Bác sĩ Chuyên Khoa",
    photo: "/assets/images/doctors/bs3.jpg",
  },
  {
    id: 4,
    name: "BS. Đặng Quốc Bảo",
    degree: "BS.",
    specialty: "Nhi khoa",
    price: 200000,
    rating: 5.0,
    visits: 10,
    hospital: "Bác sĩ Chuyên Khoa",
    photo: "/assets/images/doctors/bs4.jpg",
  },
];

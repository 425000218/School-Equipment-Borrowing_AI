// ĐĂNG KÝ PHÒNG HỌC JS
document.addEventListener('DOMContentLoaded', function () {
    const slotButtons = document.querySelectorAll('.slot-btn.empty');
    const submitBtn = document.querySelector('.btn-submit-booking');

    // Xử lý chọn slot
    slotButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // Toggle lớp 'selected' (cần thêm CSS nếu muốn hiển thị khác biệt)
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                this.style.backgroundColor = ''; // Reset về mặc định của CSS
                this.innerText = 'Trống';
            } else {
                // Hủy chọn các slot khác nếu chỉ cho phép chọn 1 (tùy nhu cầu)
                // slotButtons.forEach(b => {
                //     b.classList.remove('selected');
                //     b.style.backgroundColor = '';
                //     b.innerText = 'Trống';
                // });

                this.classList.add('selected');
                this.style.backgroundColor = '#4caf50'; // Màu xanh lá khi chọn
                this.innerText = 'Đã chọn';
            }
        });
    });

    // Xử lý gửi yêu cầu
    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
            const selectedSlots = document.querySelectorAll('.slot-btn.selected');
            const roomType = document.querySelector('select[name="room-type"]').value;
            const roomNumber = document.querySelector('select[name="room-number"]').value;

            if (selectedSlots.length === 0) {
                alert('Vui lòng chọn ít nhất một tiết học trống!');
                return;
            }

            if (!roomType || !roomNumber) {
                alert('Vui lòng chọn đầy đủ thông tin phòng học!');
                return;
            }

            alert('Yêu cầu đăng ký phòng ' + roomNumber + ' đã được gửi thành công!');

            // To-do: Gửi dữ liệu về server hoặc xử lý tiếp
        });
    }
});

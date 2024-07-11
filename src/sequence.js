export default function (self) {
	if (self.mvp.sequence === undefined) {
		self.mvp.sequence = 1 // sequence number 0 reserved
	}
	let sequence = self.mvp.sequence.toString(36).padStart(4, '0')
	self.mvp.sequence = self.mvp.sequence >= 1679615 ? 1 : self.mvp.sequence + 1
	return sequence
}
